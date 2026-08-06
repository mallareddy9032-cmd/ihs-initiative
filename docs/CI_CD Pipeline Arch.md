## **1\. CI/CD Pipeline Architecture (GitHub Actions $\\to$ AWS EKS)**

We will utilize a **Blue/Green deployment model** orchestrated via Kubernetes (AWS EKS). This ensures that if a new code version breaks the WebSocket connections, the load balancer instantly reverts traffic to the previous stable container without dropping active teleconsultations.

| Pipeline Stage | Toolchain / Framework | Execution Logic & Security Guardrails |
| :---- | :---- | :---- |
| **1\. Source & Commit** | GitHub Enterprise | Code merges require two architect approvals. **Branch protection** enforces strict adherence to main, staging, and feature/\* paradigms. |
| **2\. Continuous Integration** | GitHub Actions, Jest (FSM) | Automated testing of the Master Case FSM. Validates state transitions (e.g., forcing a ₹499 co-pay block). Mocks BLE payload streams to ensure the WebRTC downsampler triggers correctly. |
| **3\. Security & Audit** | SonarQube, Trivy, Checkov | **Checkov** scans Terraform IaC to ensure WORM RDS tables lack DELETE/UPDATE permissions. **Trivy** scans Docker images for CVEs in Node.js dependencies. |
| **4\. Artifact Build** | Docker, AWS ECR, Fastlane | Cloud Engine packaged into Docker containers (pushed to Elastic Container Registry). Fastlane automates the ruggedized Android APK build for the Field Tablets. |
| **5\. Continuous Deployment** | ArgoCD, AWS EKS, Terraform | ArgoCD detects new ECR images and orchestrates the Blue/Green shift. Terraform applies schema migrations to the PostgreSQL Hot Store without locking read-threads. |

## **2\. Phased Roll-Out Strategy**

Moving from code to a live medical fleet requires extreme caution. We will execute a 4-phase rollout to hit the **1,200 Active Enrolled Family Units** and **₹9,00,000 MRR** targets without compromising patient safety.

### **Phase 1: Engine Shadow Run (Weeks 1-2)**

* **Objective:** Validate backend math, FSM routing, and database integrity under synthetic load.  
* **Protocol:** Zero physical hardware deployed. The CI/CD pipeline pumps 10,000 synthetic JSON BLE payloads into the PostgreSQL hot store.  
* **Success Metric:** System correctly identifies 100% of synthetic SpO\_2 \< 90% inputs, routes them to CRITICAL\_TRANSIT\_PENDING, and successfully migrates Day 31 synthetic media to AWS Glacier.

### **Phase 2: Alpha Fleet & Hardware Handshake (Weeks 3-4)**

* **Objective:** Calibrate BLE GATT reliability and Dual-Pin GPS mapping in the physical Anantapur topology (Gooty, Dharmavaram).  
* **Protocol:** Deploy **1 outsourced ambulance** staffed with internal team members acting as mock patients.  
* **Hardware Test:** Drive into known 2G/Edge dead zones to force the 60-second BLE timeout, capture the local SQLite photo fallback, and verify the background sync daemon pushes the batch when LTE is restored.  
* **Success Metric:** WebRTC successfully adaptive-downsamples video while protecting the stethoscope audio feed in live field conditions.

### **Phase 3: Beta "Safe Harbor" Launch (Weeks 5-8)**

* **Objective:** Live patient testing with a controlled cohort to test the Capitation Economics and MLC workflows.  
* **Protocol:** Onboard the first **200 Family Units** (focusing on Tier 3 NRI Sponsor accounts). Deploy the full **2-ambulance fleet**.  
* **Focus Area:** Dispatchers monitor the Dual-Pin UI. Field nurses actively utilize the stock-aware Rx pad to ensure physical ambulance drug inventory perfectly matches the cloud ledger.  
* **Success Metric:** Capitation API correctly applies the ₹0 base fee for the first visit and successfully intercepts/charges the ₹499 out-of-quota co-pay for subsequent visits.

### **Phase 4: Full Production Go-Live (Month 3 Onward)**

* **Objective:** Scale to maximum pilot capacity and achieve target unit economics.  
* **Protocol:** Open enrollment to achieve the target **1,200 Family Units**.  
* **Operational Tempo:** Fleet operations shift to the target **5 to 8 dispatches/vehicle/day**. The 08:00 PM – 06:00 AM Night-Shift Standby protocol activates to eliminate cold-start delays.  
* **Success Metric:** Achievement of ₹9,00,000 MRR and zero WORM compliance breaches during government audits.

## **1\. Provider & Core Security Configurations (`provider.tf`)**

This file establishes the deployment region and provisions the AWS Key Management Service (KMS) keys that will encrypt the PostgreSQL database and the S3 Glacier Vaults at rest.

Terraform  
\# \==============================================================================  
\# provider.tf \- AWS REGION & KMS ENCRYPTION CORE  
\# \==============================================================================  
terraform {  
  required\_providers {  
    aws \= {  
      source  \= "hashicorp/aws"  
      version \= "\~\> 5.0"  
    }  
  }  
}

provider "aws" {  
  region \= "ap-south-2" \# Hyderabad Region for Data Sovereignty  
  default\_tags {  
    tags \= {  
      Project     \= "Integrated-Health-System"  
      Environment \= "Production"  
      Component   \= "Core-Infrastructure"  
    }  
  }  
}

\# KMS Key for AES-256 GCM Encryption (DPDP Compliance)  
resource "aws\_kms\_key" "ihs\_core\_kms" {  
  description             \= "KMS key for IHS PostgreSQL Hot Store and Glacier Cold Vault"  
  deletion\_window\_in\_days \= 30  
  enable\_key\_rotation     \= true  
}

resource "aws\_kms\_alias" "ihs\_core\_kms\_alias" {  
  name          \= "alias/ihs-core-encryption"  
  target\_key\_id \= aws\_kms\_key.ihs\_core\_kms.key\_id  
}

## **2\. PostgreSQL Hot Store (`rds.tf`)**

This provisions the highly available, encrypted database that acts as the real-time FSM engine. It utilizes Multi-AZ deployment for zero-downtime failover and enforces hardware-level AES-256 encryption using the KMS key.

Terraform  
\# \==============================================================================  
\# rds.tf \- POSTGRESQL HOT STORE (DAYS 1-30)  
\# \==============================================================================  
resource "aws\_db\_instance" "ihs\_postgres\_hot\_store" {  
  identifier             \= "ihs-antp-prod-db"  
  engine                 \= "postgres"  
  engine\_version         \= "15.4"  
  instance\_class         \= "db.r6g.large" \# Memory-optimized Graviton2 for high WebSocket/FSM concurrency  
  allocated\_storage      \= 100  
  max\_allocated\_storage  \= 500            \# Auto-scaling storage  
    
  db\_name                \= "ihs\_core\_db"  
  username               \= var.db\_admin\_user  
  password               \= var.db\_admin\_password  
    
  \# Security & Compliance  
  storage\_encrypted      \= true  
  kms\_key\_id             \= aws\_kms\_key.ihs\_core\_kms.arn  
  multi\_az               \= true  
  publicly\_accessible    \= false  
    
  \# Network Routing  
  vpc\_security\_group\_ids \= \[aws\_security\_group.rds\_sg.id\]  
  db\_subnet\_group\_name   \= aws\_db\_subnet\_group.ihs\_private\_subnets.name  
    
  \# Audit & Maintenance  
  enabled\_cloudwatch\_logs\_exports \= \["postgresql", "upgrade"\]  
  backup\_retention\_period         \= 7  
  auto\_minor\_version\_upgrade      \= true  
  deletion\_protection             \= true \# Prevents accidental deletion of the WORM audit tables  
}

## **3\. DPDP WORM Cold Vault (`s3_glacier.tf`)**

This configures the bucket where the Day 31 cron daemon will migrate heavy media (Safe Harbor videos, photo fallbacks). Crucially, it utilizes **S3 Object Lock** in Compliance Mode to satisfy the NMC Write-Once-Read-Many (WORM) requirement. Once a file is written here, it is mathematically impossible for even a root AWS administrator to delete it before the retention period expires.

Terraform  
\# \==============================================================================  
\# s3\_glacier.tf \- IMMUTABLE COLD VAULT (DAY 31+)  
\# \==============================================================================  
resource "aws\_s3\_bucket" "ihs\_cold\_vault" {  
  bucket \= "ihs-antp-cold-vault-wrm"

  \# Enforce WORM (Write-Once-Read-Many) at the hardware level  
  object\_lock\_enabled \= true  
}

resource "aws\_s3\_bucket\_server\_side\_encryption\_configuration" "vault\_encryption" {  
  bucket \= aws\_s3\_bucket.ihs\_cold\_vault.id

  rule {  
    apply\_server\_side\_encryption\_by\_default {  
      kms\_master\_key\_id \= aws\_kms\_key.ihs\_core\_kms.arn  
      sse\_algorithm     \= "aws:kms"  
    }  
  }  
}

resource "aws\_s3\_bucket\_object\_lock\_configuration" "vault\_worm\_policy" {  
  bucket \= aws\_s3\_bucket.ihs\_cold\_vault.id

  rule {  
    default\_retention {  
      mode  \= "COMPLIANCE" \# Cannot be altered by any user, including root  
      days  \= 3650         \# 10-year legal medical retention period  
    }  
  }  
}

## **4\. Kubernetes Compute Cluster (`eks.tf`)**

This provisions the Elastic Kubernetes Service (EKS) cluster that will host our Node.js Cloud Engine, WebSocket gateways, and WebRTC signaling servers.

Terraform  
\# \==============================================================================  
\# eks.tf \- COMPUTE ENGINE FOR APIS & WEBRTC  
\# \==============================================================================  
resource "aws\_eks\_cluster" "ihs\_compute\_core" {  
  name     \= "ihs-antp-cluster"  
  role\_arn \= aws\_iam\_role.eks\_cluster\_role.arn  
  version  \= "1.29"

  vpc\_config {  
    subnet\_ids              \= aws\_subnet.private\[\*\].id  
    endpoint\_private\_access \= true  
    endpoint\_public\_access  \= false \# All traffic routes through API Gateway / ALB  
  }

  encryption\_config {  
    resources \= \["secrets"\]  
    provider {  
      key\_arn \= aws\_kms\_key.ihs\_core\_kms.arn  
    }  
  }  
}

resource "aws\_eks\_node\_group" "ihs\_api\_nodes" {  
  cluster\_name    \= aws\_eks\_cluster.ihs\_compute\_core.name  
  node\_group\_name \= "ihs-websocket-webrtc-nodes"  
  node\_role\_arn   \= aws\_iam\_role.eks\_node\_role.arn  
  subnet\_ids      \= aws\_subnet.private\[\*\].id

  \# Compute selection optimized for continuous WebSocket/WebRTC I/O  
  instance\_types  \= \["c6g.large"\] 

  scaling\_config {  
    desired\_size \= 3  
    max\_size     \= 10 \# Auto-scales during active Safe Harbor / Teleconsult spikes  
    min\_size     \= 2  
  }

  update\_config {  
    max\_unavailable \= 1 \# Ensures Blue/Green rolling updates never drop active calls  
  }  
}

### **Strategic Architect Notes:**

* **Instance Selection:** We deployed `db.r6g.large` (Memory-optimized Graviton2) for the PostgreSQL database to rapidly handle the continuous `500ms` BLE GATT inserts syncing from the field tablets, preventing connection pooling bottlenecks.  
* **WORM Compliance Enforcement:** The `COMPLIANCE` mode in the `aws_s3_bucket_object_lock_configuration` acts as the ultimate medico-legal shield. If a case is audited, IHS can mathematically prove to government regulators that the teleconsultation artifacts have remained untampered since the moment the SHA-256 e-signature was applied.  
* **Security Isolation:** The EKS cluster's `endpoint_public_access = false` configuration means the actual compute nodes are invisible to the public internet. The Client Apps and Tablets will interact strictly through an AWS Application Load Balancer (ALB) equipped with Web Application Firewall (WAF) rules to drop DDoS attempts against the panic endpoints.

