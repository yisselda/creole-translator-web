import { useState, useEffect, useCallback, useRef } from 'react';
import { WebSocketMessage, WebSocketResponse } from '../types/api';

export const useWebSocket = (url: string) => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (socket?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    try {
      const ws = new WebSocket(url);
      
      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketResponse = JSON.parse(event.data);
          setLastMessage(event.data);
          
          if (message.type === 'error') {
            setError(message.data.message || 'WebSocket error');
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
          setError('Failed to parse server message');
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);
        setSocket(null);
        
        // Attempt to reconnect if not a normal closure
        if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          const timeout = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current += 1;
            connect();
          }, timeout);
        }
      };

      ws.onerror = (event) => {
        console.error('WebSocket error:', event);
        setError('WebSocket connection error');
      };

      setSocket(ws);
    } catch (err) {
      console.error('Failed to create WebSocket:', err);
      setError('Failed to create WebSocket connection');
    }
  }, [url, socket]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (socket) {
      socket.close(1000, 'Manual disconnect');
    }
    
    setSocket(null);
    setIsConnected(false);
    reconnectAttemptsRef.current = 0;
  }, [socket]);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (socket?.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify(message));
      } catch (err) {
        console.error('Failed to send WebSocket message:', err);
        setError('Failed to send message');
      }
    } else {
      console.warn('WebSocket not connected');
      setError('WebSocket not connected');
    }
  }, [socket]);

  const sendAudioChunk = useCallback((base64Audio: string) => {
    sendMessage({
      type: 'audio_chunk',
      data: base64Audio
    });
  }, [sendMessage]);

  const sendConfig = useCallback((config: any) => {
    sendMessage({
      type: 'config',
      data: JSON.stringify(config)
    });
  }, [sendMessage]);

  const sendStop = useCallback(() => {
    sendMessage({
      type: 'stop'
    });
  }, [sendMessage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    // Connection state
    isConnected,
    error,
    lastMessage,
    
    // Connection management
    connect,
    disconnect,
    
    // Message sending
    sendMessage,
    sendAudioChunk,
    sendConfig,
    sendStop
  };
};