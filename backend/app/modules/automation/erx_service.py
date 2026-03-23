from app.models.api_response_log import APIResponseLog

class ERxService:
    async def send_prescription(self, data: dict):
        """Mocks sending a prescription via Surescripts format."""
        mock_response = {"status": "accepted", "rx_id": "RX-999"}
        
        await APIResponseLog(
            provider="eRx",
            endpoint="/Prescribe",
            status_code=200,
            request_data=data,
            response_data=mock_response
        ).insert()
        
        return mock_response

erx_service = ERxService()
