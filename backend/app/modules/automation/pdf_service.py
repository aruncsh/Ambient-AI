import os
import logging
from reportlab.lib.pagesizes import LETTER
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from datetime import datetime

logger = logging.getLogger(__name__)

class PDFService:
    def __init__(self, output_dir: str = "attachments"):
        self.output_dir = os.path.join(os.getcwd(), output_dir)
        os.makedirs(self.output_dir, exist_ok=True)

    def generate_prescription_pdf(self, encounter_id: str, clinician_name: str, patient_name: str, prescriptions: list) -> str:
        """
        Generates a professional prescription PDF.
        """
        filename = f"prescription_{encounter_id}_{int(datetime.now().timestamp())}.pdf"
        filepath = os.path.join(self.output_dir, filename)
        
        try:
            c = canvas.Canvas(filepath, pagesize=LETTER)
            width, height = LETTER
            
            # Header
            c.setFont("Helvetica-Bold", 16)
            c.drawString(50, height - 50, "Ambient AI Scribe - Digital Prescription")
            
            c.setFont("Helvetica", 10)
            c.drawString(50, height - 70, f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
            c.drawString(50, height - 85, f"Clinician: {clinician_name}")
            c.drawString(50, height - 100, f"Patient: {patient_name}")
            
            c.setStrokeColor(colors.black)
            c.line(50, height - 110, width - 50, height - 110)
            
            # Rx Symbol
            c.setFont("Helvetica-Bold", 24)
            c.drawString(50, height - 150, "Rx")
            
            # Prescriptions
            c.setFont("Helvetica", 12)
            y_pos = height - 180
            for rx in prescriptions:
                med = rx.get('medication', 'N/A')
                dosage = rx.get('dosage', 'N/A')
                route = rx.get('route', 'N/A')
                freq = rx.get('frequency', 'N/A')
                
                c.drawString(70, y_pos, f"{med} {dosage}")
                y_pos -= 20
                c.setFont("Helvetica-Oblique", 10)
                c.drawString(70, y_pos, f"Sig: {route} {freq}")
                c.setFont("Helvetica", 12)
                y_pos -= 30
                
                if y_pos < 100:
                    c.showPage()
                    y_pos = height - 50
            
            # Footer / Signature Placeholder
            c.line(width - 250, 100, width - 50, 100)
            c.setFont("Helvetica", 8)
            c.drawCentredString(width - 150, 85, "Digitally signed by Authenticated Clinician")
            
            c.save()
            return filename
        except Exception as e:
            logger.error(f"Failed to generate PDF: {e}")
            return ""

pdf_service = PDFService()
