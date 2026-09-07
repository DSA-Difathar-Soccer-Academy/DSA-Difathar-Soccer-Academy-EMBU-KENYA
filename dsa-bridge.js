// ============================================
// DSA BRIDGE v4.1 - Professional Communication Layer
// ============================================

(function() {
    'use strict';

    class DSABridge {
        constructor() {
            this.listeners = {
                registration: [],
                invoice: [],
                payment: [],
                system: [],
                member: [],
                heartbeat: []
            };
            this.connected = true;
            this.broadcastChannel = null;
            this.eventLog = [];
            this.MAX_LOG = 100;
            this._initChannel();
            this._pingInterval = setInterval(() => this._heartbeat(), 30000);
            
            try {
                const stored = localStorage.getItem('dsa_bridge_events');
                if (stored) {
                    const events = JSON.parse(stored);
                    this.eventLog = events.slice(-this.MAX_LOG);
                }
            } catch(e) {}
            
            console.log('✅ DSA Bridge initialized');
        }

        _initChannel() {
            try {
                if (typeof BroadcastChannel !== 'undefined') {
                    this.broadcastChannel = new BroadcastChannel('dsa_bridge');
                    this.broadcastChannel.onmessage = (event) => {
                        if (event.data && event.data.type) {
                            this._handleExternalMessage(event.data);
                        }
                    };
                    console.log('✅ DSA Bridge: BroadcastChannel active');
                }
            } catch(e) {
                console.warn('⚠️ DSA Bridge: BroadcastChannel fallback mode');
                this.broadcastChannel = null;
            }
        }

        _handleExternalMessage(data) {
            if (!data || !data.type) return;
            
            const listeners = this.listeners[data.type] || [];
            listeners.forEach(cb => {
                try {
                    cb(data);
                } catch(e) {
                    console.warn('⚠️ Listener error:', e);
                }
            });
            
            this._log(data);
        }

        _log(data) {
            this.eventLog.push({
                timestamp: new Date().toISOString(),
                data: data
            });
            if (this.eventLog.length > this.MAX_LOG) {
                this.eventLog.shift();
            }
            
            try {
                localStorage.setItem('dsa_bridge_events', JSON.stringify(this.eventLog));
            } catch(e) {}
        }

        _heartbeat() {
            if (this.broadcastChannel) {
                try {
                    this.broadcastChannel.postMessage({
                        type: 'heartbeat',
                        timestamp: new Date().toISOString(),
                        source: 'dsa_bridge'
                    });
                } catch(e) {}
            }
            
            const heartbeatListeners = this.listeners.heartbeat || [];
            heartbeatListeners.forEach(cb => {
                try {
                    cb({ type: 'heartbeat', timestamp: new Date().toISOString() });
                } catch(e) {}
            });
        }

        subscribe(callback) {
            if (typeof callback !== 'function') return () => {};
            
            const wrapped = (data) => {
                try {
                    callback(data);
                } catch(e) {
                    console.warn('⚠️ Subscription error:', e);
                }
            };
            
            if (!this.listeners.system) {
                this.listeners.system = [];
            }
            this.listeners.system.push(wrapped);
            
            return () => {
                const index = this.listeners.system.indexOf(wrapped);
                if (index !== -1) {
                    this.listeners.system.splice(index, 1);
                }
            };
        }

        on(type, callback) {
            if (typeof callback !== 'function') return () => {};
            
            if (!this.listeners[type]) {
                this.listeners[type] = [];
            }
            this.listeners[type].push(callback);
            
            return () => {
                const index = this.listeners[type].indexOf(callback);
                if (index !== -1) {
                    this.listeners[type].splice(index, 1);
                }
            };
        }

        emit(type, data) {
            const eventData = {
                type: type,
                data: data || {},
                timestamp: new Date().toISOString(),
                source: window.location.pathname.split('/').pop() || 'unknown'
            };

            this._log(eventData);

            const listeners = this.listeners[type] || [];
            listeners.forEach(cb => {
                try {
                    cb(eventData);
                } catch(e) {
                    console.warn('⚠️ Listener error:', e);
                }
            });

            const systemListeners = this.listeners.system || [];
            systemListeners.forEach(cb => {
                try {
                    cb(eventData);
                } catch(e) {
                    console.warn('⚠️ System listener error:', e);
                }
            });

            if (this.broadcastChannel) {
                try {
                    this.broadcastChannel.postMessage(eventData);
                } catch(e) {}
            }
        }

        emitRegistration(data) {
            this.emit('registration', data);
        }

        emitInvoice(data) {
            this.emit('invoice', data);
        }

        emitPayment(data) {
            this.emit('payment', data);
        }

        emitSystem(data) {
            this.emit('system', data);
        }

        emitMember(data) {
            this.emit('member', data);
        }

        getEvents(count = 10) {
            return this.eventLog.slice(-count);
        }

        isConnected() {
            return this.connected;
        }

        getStatus() {
            let totalListeners = 0;
            for (const key in this.listeners) {
                totalListeners += (this.listeners[key] || []).length;
            }
            return {
                connected: this.connected,
                listenerCount: totalListeners,
                eventLogSize: this.eventLog.length,
                broadcastChannel: !!this.broadcastChannel
            };
        }

        destroy() {
            if (this._pingInterval) {
                clearInterval(this._pingInterval);
                this._pingInterval = null;
            }
            if (this._fallbackInterval) {
                clearInterval(this._fallbackInterval);
                this._fallbackInterval = null;
            }
            if (this.broadcastChannel) {
                try {
                    this.broadcastChannel.close();
                } catch(e) {}
                this.broadcastChannel = null;
            }
            this.listeners = {};
            console.log('✅ DSA Bridge destroyed');
        }
    }

    const bridge = new DSABridge();
    window.dsaBridge = bridge;

    window.addEventListener('beforeunload', () => {
        bridge.emitSystem({ action: 'page_unload', url: window.location.href });
    });

    console.log('✅ DSA Bridge loaded successfully');
    console.log('📊 Status:', bridge.getStatus());

})();