class WSClient {
  private socket: WebSocket | null = null;
  private currentEncounterId: string | null = null;

  connect(encounterId: string, onMessage: (msg: any) => void) {
    // Proactive cleanup to avoid race conditions with React re-mounting
    if (this.socket) {
      const oldSocket = this.socket;
      // Remove previous listener to prevent it from triggering a retry
      oldSocket.onclose = null;
      oldSocket.onerror = null;
      oldSocket.close();
      this.socket = null;
    }

    this.currentEncounterId = encounterId;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/${encounterId}`;
    
    console.log(`WebSocket: Connecting to ${wsUrl}`);
    const socket = new WebSocket(wsUrl);
    this.socket = socket;

    socket.onopen = () => {
      // Only process if this is still the active socket
      if (this.socket !== socket) return;
      console.log("WebSocket: Global Handshake Established");
    };

    socket.onmessage = (event) => {
      if (this.socket !== socket) return;
      try {
        onMessage(JSON.parse(event.data));
      } catch (err) {
        console.error("WebSocket: Message parsing error", err);
      }
    };

    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = null;
      console.log("WebSocket Closed. Retrying...");
      setTimeout(() => {
        // Only retry if we haven't switched to another encounter or explicitly disconnected
        if (this.currentEncounterId === encounterId) {
          this.connect(encounterId, onMessage);
        }
      }, 3000);
    };

    socket.onerror = (err) => {
      if (this.socket !== socket) return;
      console.error("WebSocket: Global Capture Error:", err);
    };
  }

  send(data: any) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    }
  }

  disconnect() {
    this.currentEncounterId = null;
    if (this.socket) {
      const s = this.socket;
      s.onclose = null;
      s.onerror = null;
      s.close();
      this.socket = null;
    }
  }
}

export const wsClient = new WSClient();
