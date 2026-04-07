const API_BASE = '/api/v1';

export const api = {
  getEncounters: async () => {
    const res = await fetch(`${API_BASE}/encounters/`);
    return res.json();
  },
  createEncounter: async (patientId: string, clinicianId: string) => {
    const res = await fetch(`${API_BASE}/encounters/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_id: patientId, clinician_id: clinicianId })
    });
    return res.json();
  },
  createEmergencyEncounter: async () => {
    const res = await fetch(`${API_BASE}/encounters/emergency`, {
      method: 'POST'
    });
    return res.json();
  },
  getEncounter: async (id: string) => {
    const res = await fetch(`${API_BASE}/encounters/${id}`);
    return res.json();
  },
  completeEncounter: async (id: string, audioBlob?: Blob) => {
    if (audioBlob) {
      const formData = new FormData();
      formData.append('file', audioBlob, 'full_audio.webm');
      const res = await fetch(`${API_BASE}/encounters/${id}/stop`, {
        method: 'POST',
        body: formData
      });
      return res.json();
    }
    const res = await fetch(`${API_BASE}/encounters/${id}/stop`, {
      method: 'POST'
    });
    return res.json();
  },
  generateSOAP: async (encounterId: string) => {
    const res = await fetch(`${API_BASE}/summary/${encounterId}/generate`, {
      method: 'POST'
    });
    return res.json();
  },
  simulate: async () => {
    const res = await fetch(`/simulate`, { method: 'POST' });
    return res.json();
  },
  updateDemographics: async (id: string, demographics: any) => {
    const res = await fetch(`${API_BASE}/encounters/${id}/demographics`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(demographics)
    });
    return res.json();
  },
  transcribeChunk: async (encounterId: string, audioBlob: Blob) => {
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    const res = await fetch(`${API_BASE}/encounters/${encounterId}/transcribe`, {
      method: 'POST',
      body: formData
    });
    return res.json();
  },
  getAppointments: async () => {
    const res = await fetch(`${API_BASE}/scheduling/`);
    return res.json();
  },
  createAppointment: async (appointment: any) => {
    const res = await fetch(`${API_BASE}/scheduling/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appointment)
    });
    return res.json();
  },
  deleteAppointment: async (id: string) => {
    const res = await fetch(`${API_BASE}/scheduling/${id}`, {
      method: 'DELETE'
    });
    return res.json();
  },
  getAppointment: async (id: string) => {
    const res = await fetch(`${API_BASE}/scheduling/${id}`);
    return res.json();
  },
  updateAppointment: async (id: string, status: string) => {
    const res = await fetch(`${API_BASE}/scheduling/${id}?status=${status}`, {
      method: 'PATCH'
    });
    return res.json();
  },
  getInvoices: async () => {
    const res = await fetch(`${API_BASE}/billing/`);
    return res.json();
  },
  createInvoice: async (invoice: any) => {
    const res = await fetch(`${API_BASE}/billing/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invoice)
    });
    return res.json();
  },
  updateInvoiceStatus: async (id: string, status: string) => {
    const res = await fetch(`${API_BASE}/billing/${id}?status=${status}`, {
      method: 'PATCH'
    });
    return res.json();
  },
  getPatients: async () => {
    const res = await fetch(`${API_BASE}/users/patients`);
    return res.json();
  },
  createPatient: async (patient: any) => {
    const res = await fetch(`${API_BASE}/users/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patient)
    });
    return res.json();
  },
  getDoctors: async () => {
    const res = await fetch(`${API_BASE}/users/doctors`);
    return res.json();
  },
  createDoctor: async (doctor: any) => {
    const res = await fetch(`${API_BASE}/users/doctors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(doctor)
    });
    return res.json();
  },
  updatePatient: async (id: string, patient: any) => {
    const res = await fetch(`${API_BASE}/users/patients/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patient)
    });
    return res.json();
  },
  updateDoctor: async (id: string, doctor: any) => {
    const res = await fetch(`${API_BASE}/users/doctors/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(doctor)
    });
    return res.json();
  },
  getStats: async () => {
    const res = await fetch(`${API_BASE}/stats/`);
    return res.json();
  },
  extractDemographics: async (text: string, fast: boolean = false) => {
    const res = await fetch(`${API_BASE}/ai/extract-demographics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, fast })
    });
    return res.json();
  }
};
