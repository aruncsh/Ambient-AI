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
  }
};
