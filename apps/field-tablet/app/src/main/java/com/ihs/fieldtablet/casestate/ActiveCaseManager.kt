// ============================================================================
// FILE: casestate/ActiveCaseManager.kt
// CONTEXT: In-memory active case context for BLE writes
// ============================================================================

package com.ihs.fieldtablet.casestate

object ActiveCaseManager {
    @Volatile
    var currentCaseId: String = "UNASSIGNED"
        private set

    @Volatile
    var patientIhsUid: String? = null
        private set

    @Volatile
    var isMlcActive: Boolean = false
        private set

    fun bindCase(caseId: String, patientUid: String? = null) {
        currentCaseId = caseId
        patientIhsUid = patientUid
    }

    fun activateSafeHarbor() {
        isMlcActive = true
    }

    fun clear() {
        currentCaseId = "UNASSIGNED"
        patientIhsUid = null
        isMlcActive = false
    }
}
