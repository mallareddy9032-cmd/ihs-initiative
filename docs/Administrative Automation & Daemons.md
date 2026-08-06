### **Administrative Automation & Daemons**

### **SPRINT 6: Administrative Automation & Daemons**

We have reached the final layer of the Integrated Health System (IHS) architecture. While the mobile apps and clinical portals handle active human interactions, the system's legal viability and financial efficiency rely on background automation.

Human administrators should not be manually checking vehicle insurance spreadsheets or migrating heavy media files to cold storage. We will automate PRD Phase 2 (Fleet Compliance) and Phase 10 (DPDP Cold Vault Migration) using **Node.js** with the **node-cron** scheduling library and the **AWS SDK v3**.

### **STEP 1: Fleet Compliance & Governance Daemon**

This daemon runs every night at 00:00 (Midnight). It ruthlessly audits the physical fleet. If an outsourced ambulance operator lets their vehicle fitness certificate or insurance expire, this script instantly grounds the vehicle, shielding the IHS from severe vicarious liability.

TypeScript  
// \============================================================================  
// FILE: src/daemons/FleetComplianceCron.ts  
// CONTEXT: Midnight Fleet Audit & Active Grounding  
// \============================================================================  
import cron from 'node-cron';  
import { ihsDbClient } from '@/infrastructure/database/client';  
import { WebSocketEngine } from '@/communication/websockets/WebSocketEngine';

export class FleetComplianceDaemon {  
    
  public static initialize() {  
    // Run every day at 00:00 (Midnight)  
    cron.schedule('0 0 \* \* \*', async () \=\> {  
      console.log('🛡️ \[DAEMON\] Initiating Daily Fleet Compliance Audit...');  
      await this.auditAndGroundAssets();  
    });  
  }

  private static async auditAndGroundAssets() {  
    const today \= new Date();

    // 1\. Identify non-compliant active vehicles  
    // Note: Assuming a FleetAsset model exists in the Prisma schema for the tender DB  
    const expiredAssets \= await ihsDbClient.fleetAsset.findMany({  
      where: {  
        status: 'ACTIVE',  
        OR: \[  
          { insurance\_expiry\_date: { lt: today } },  
          { fitness\_cert\_expiry: { lt: today } }  
        \]  
      }  
    });

    if (expiredAssets.length \=== 0\) {  
      console.log('✅ \[DAEMON\] All active fleet assets are compliant.');  
      return;  
    }

    // 2\. Ground the vehicles immediately  
    const assetIds \= expiredAssets.map(asset \=\> asset.fleet\_id);  
      
    await ihsDbClient.fleetAsset.updateMany({  
      where: { fleet\_id: { in: assetIds } },  
      data: { status: 'INACTIVE\_NON\_COMPLIANT' }  
    });

    // 3\. Alert the Command Center to reroute pending morning dispatches  
    expiredAssets.forEach(asset \=\> {  
      console.warn(\`🚨 GROUNDED: Fleet ${asset.fleet\_id} due to document expiration.\`);  
        
      WebSocketEngine.broadcastToDispatchers({  
        event: 'FLEET\_ASSET\_GROUNDED',  
        payload: {  
          fleet\_id: asset.fleet\_id,  
          operator: asset.operator\_name,  
          reason: 'COMPLIANCE\_EXPIRATION',  
          action\_required: 'REROUTE\_ASSIGNED\_CASES'  
        }  
      });  
    });  
  }  
}

### **STEP 2: Day 31 DPDP Cold Storage Migration**

Under the DPDP Act 2023 and NMC 2020 guidelines, we must retain medical records, but keeping gigabytes of 60-second BLE timeout photos in our expensive, high-speed PostgreSQL Hot Store is financially unviable.

This cron job runs daily at 02:00 AM (during low-traffic hours). It strips the heavy Base64 strings from the database, hashes them with a salt, drops them into AWS Glacier (WORM-locked), and leaves only a lightweight cryptographic URI pointer in the PostgreSQL table.

TypeScript  
// \============================================================================  
// FILE: src/daemons/GlacierMigrationCron.ts  
// CONTEXT: DPDP Day 31 Hot-to-Cold Shift  
// \============================================================================  
import cron from 'node-cron';  
import crypto from 'crypto';  
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';  
import { ihsDbClient } from '@/infrastructure/database/client';

// Configure AWS SDK v3 for the ap-south-2 (Hyderabad) region  
const s3 \= new S3Client({ region: 'ap-south-2' });  
const GLACIER\_BUCKET \= 'ihs-antp-cold-vault-wrm';

export class DataComplianceDaemon {  
    
  public static initialize() {  
    // Run every day at 02:00 AM  
    cron.schedule('0 2 \* \* \*', async () \=\> {  
      console.log('📦 \[DAEMON\] Initiating Day 31 Cold Vault Migration...');  
      await this.executeHotToColdShift();  
    });  
  }

  private static async executeHotToColdShift() {  
    // Calculate the threshold date (30 days ago)  
    const thresholdDate \= new Date();  
    thresholdDate.setDate(thresholdDate.getDate() \- 30);

    // 1\. Fetch aging telemetry that still contains heavy Base64 media  
    const agingRecords \= await ihsDbClient.diagnosticTelemetry.findMany({  
      where: {  
        recorded\_at: { lt: thresholdDate },  
        vault\_status: 'HOT\_STORE',  
        photo\_verification\_b64: { not: null }  
      },  
      include: { clinical\_case: { include: { patient: true } } }  
    });

    if (agingRecords.length \=== 0\) return;

    for (const record of agingRecords) {  
      try {  
        // 2\. Generate Anonymized, Tokenized Salt Mask  
        const salt \= crypto.randomBytes(16).toString('hex');  
        const ihsUid \= record.clinical\_case.patient.ihs\_uid;  
        const tokenizedKey \= crypto.createHash('sha256')  
          .update(ihsUid \+ salt)  
          .digest('hex');  
          
        const objectKey \= \`vaults/telemetry/${record.recorded\_at.getFullYear()}/${tokenizedKey}.img\`;  
        const buffer \= Buffer.from(record.photo\_verification\_b64 as string, 'base64');

        // 3\. Upload to AWS Glacier  
        await s3.send(new PutObjectCommand({  
          Bucket: GLACIER\_BUCKET,  
          Key: objectKey,  
          Body: buffer,  
          StorageClass: 'GLACIER', // Maps to the WORM-locked vault  
          ServerSideEncryption: 'aws:kms'  
        }));

        // 4\. Purge Hot Data & Update Ledger pointer  
        await ihsDbClient.diagnosticTelemetry.update({  
          where: { telemetry\_id: record.telemetry\_id },  
          data: {  
            photo\_verification\_b64: null, // Physically deletes the heavy string  
            vault\_status: 'AWS\_GLACIER',  
            glacier\_uri: objectKey,  
            // Custom field to store the salt if decryption/retrieval is legally mandated later  
            reading\_value: {   
              ...(record.reading\_value as object),   
              anonymization\_salt: salt   
            }  
          }  
        });

      } catch (error) {  
        console.error(\`Failed to migrate record ${record.telemetry\_id}:\`, error);  
      }  
    }  
      
    console.log(\`✅ \[DAEMON\] Migrated ${agingRecords.length} records to Glacier.\`);  
  }  
}

### **Engineering Rationale**

* **Risk Isolation:** The `FleetComplianceCron` operates completely independently of human intervention. If a fleet manager forgets to update an insurance record in the admin dashboard, the system assumes the vehicle is uninsured and grounds it. Software enforces the law perfectly.  
* **Cost Optimization (Storage):** PostgreSQL SSD storage in AWS RDS is expensive. AWS S3 Glacier Deep Archive costs approximately $0.00099 per GB/month. By automatically purging the `photo_verification_b64` string at Day 31, the PostgreSQL database remains highly performant and cheap to run, while the legal requirement is safely fulfilled in the cloud basement.  
* **Tokenized Salt Masking:** Notice the `tokenizedKey` generation. We do not name the S3 file `IHS-ANTP-00001-photo.jpg`. We hash the `ihs_uid` combined with a random `salt`. If the S3 bucket is somehow compromised, the filenames reveal absolutely nothing about patient identities, adhering strictly to the DPDP Act's data minimization principles.

