class WSClient {
  private socket: WebSocket | null = null;

  connect(encounterId: string, onMessage: (msg: any) => void) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.socket = new WebSocket(`${protocol}//${window.location.host}/ws/${encounterId}`);

    this.socket.onmessage = (event) => {
      onMessage(JSON.parse(event.data));
    };

    this.socket.onclose = () => {
      console.log("WebSocket Closed. Retrying...");
      setTimeout(() => this.connect(encounterId, onMessage), 3000);
    };
  }

  send(data: any) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    }
  }

  disconnect() {
    this.socket?.close();
  }
}

export const wsClient = new WSClient();
