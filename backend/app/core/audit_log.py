from fastapi import Request
from app.models.audit_log import AuditLog
import time

async def audit_log_middleware(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    
    # HIPAA: Log all PHI access/attempts
    if "/api/v1/" in request.url.path:
        await AuditLog(
            user_id="anonymous", # Should be derived from JWT in real app
            action=request.method,
            resource_id=request.url.path,
            details=f"Status: {response.status_code}, ProcessTime: {process_time:.4f}s",
            ip_address=request.client.host if request.client else "unknown"
        ).insert()
        
    return response
