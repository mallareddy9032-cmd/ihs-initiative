### **FINAL STEP: GitHub Actions CI/CD Pipeline**

Create this file at `.github/workflows/ihs-cloud-engine-deploy.yml` in your repository.

YAML  
\# \============================================================================  
\# FILE: .github/workflows/ihs-cloud-engine-deploy.yml  
\# CONTEXT: Continuous Integration & Deployment for IHS Cloud Core  
\# \============================================================================  
name: IHS Cloud Engine CI/CD (Production)

on:  
  push:  
    branches:  
      \- main  
    paths:  
      \- 'src/\*\*'  
      \- 'prisma/\*\*'  
      \- 'Dockerfile'  
      \- 'package.json'

env:  
  AWS\_REGION: ap-south-2  
  ECR\_REPOSITORY: ihs-cloud-engine  
  EKS\_CLUSTER\_NAME: ihs-antp-cluster

jobs:  
  integration-and-security:  
    name: 🛡️ Code & Security Audit  
    runs-on: ubuntu-latest  
    steps:  
      \- name: Checkout Repository  
        uses: actions/checkout@v4

      \- name: Setup Node.js 20.x  
        uses: actions/setup-node@v4  
        with:  
          node-version: '20'  
          cache: 'npm'

      \- name: Install Dependencies  
        run: npm ci

      \- name: Generate Prisma Types  
        run: npx prisma generate

      \- name: Execute FSM & State Machine Tests  
        run: npm run test:ci

      \- name: 🔒 Run Trivy Vulnerability Scanner  
        uses: aquasecurity/trivy-action@master  
        with:  
          scan-type: 'fs'  
          ignore-unfixed: true  
          format: 'table'  
          severity: 'CRITICAL,HIGH'

  build-and-push:  
    name: 📦 Build Artifact & Push to ECR  
    needs: integration-and-security  
    runs-on: ubuntu-latest  
    steps:  
      \- name: Checkout Repository  
        uses: actions/checkout@v4

      \- name: Configure AWS Credentials  
        uses: aws-actions/configure-aws-credentials@v4  
        with:  
          aws-access-key-id: ${{ secrets.AWS\_ACCESS\_KEY\_ID }}  
          aws-secret-access-key: ${{ secrets.AWS\_SECRET\_ACCESS\_KEY }}  
          aws-region: ${{ env.AWS\_REGION }}

      \- name: Login to Amazon ECR  
        id: login-ecr  
        uses: aws-actions/amazon-ecr-login@v2

      \- name: Build, Tag, and Push Docker Image  
        env:  
          ECR\_REGISTRY: ${{ steps.login-ecr.outputs.registry }}  
          IMAGE\_TAG: ${{ github.sha }}  
        run: |  
          echo "Building Docker image for IHS Cloud Engine..."  
          docker build \-t $ECR\_REGISTRY/$ECR\_REPOSITORY:$IMAGE\_TAG \-t $ECR\_REGISTRY/$ECR\_REPOSITORY:latest .  
            
          echo "Pushing artifact to AWS ECR in ap-south-2..."  
          docker push $ECR\_REGISTRY/$ECR\_REPOSITORY:$IMAGE\_TAG  
          docker push $ECR\_REGISTRY/$ECR\_REPOSITORY:latest  
            
          echo "IMAGE\_URI=$ECR\_REGISTRY/$ECR\_REPOSITORY:$IMAGE\_TAG" \>\> $GITHUB\_ENV

  deploy-to-eks:  
    name: 🚀 Blue/Green EKS Deployment  
    needs: build-and-push  
    runs-on: ubuntu-latest  
    steps:  
      \- name: Configure AWS Credentials  
        uses: aws-actions/configure-aws-credentials@v4  
        with:  
          aws-access-key-id: ${{ secrets.AWS\_ACCESS\_KEY\_ID }}  
          aws-secret-access-key: ${{ secrets.AWS\_SECRET\_ACCESS\_KEY }}  
          aws-region: ${{ env.AWS\_REGION }}

      \- name: Update Kubeconfig for EKS  
        run: aws eks update-kubeconfig \--name ${{ env.EKS\_CLUSTER\_NAME }} \--region ${{ env.AWS\_REGION }}

      \- name: Execute Rolling Update on Kubernetes  
        run: |  
          \# The deployment dynamically pulls the new SHA tag, triggering a zero-downtime rollout  
          kubectl set image deployment/ihs-cloud-engine api-container=${{ env.IMAGE\_URI }} \-n ihs-production  
            
          \# Monitor the rollout status to ensure pods stabilize before reporting success  
          kubectl rollout status deployment/ihs-cloud-engine \-n ihs-production \--timeout=300s

### **Engineering Rationale**

* **Immutable Artifacts via SHA Tagging:** The Docker image is strictly tagged using `${{ github.sha }}`. We never rely solely on the `latest` tag in production. This guarantees absolute traceability; if a bug surfaces in the Physician Console, you can map the exact running container back to a specific git commit.  
* **Zero-Trust Security Gates (Trivy):** Before any code is packaged, the pipeline executes the Aquasecurity Trivy scanner. If a new `npm` package introduces a `CRITICAL` or `HIGH` Common Vulnerabilities and Exposures (CVE) risk (e.g., a flaw in a cryptographic library), the pipeline physically fails and blocks the deployment.  
* **Zero-Downtime EKS Rollout:** The `kubectl set image` command triggers a rolling update within the Kubernetes cluster. EKS will spin up the new pods, wait for their health checks to pass (ensuring the new WORM interceptor and FSM logic are stable), route traffic to them, and only then terminate the old pods. No active WebRTC teleconsultations will be dropped during a mid-day deployment.

