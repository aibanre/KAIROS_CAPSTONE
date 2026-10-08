const EventEmitter = require('events');

const events = new EventEmitter();

function publish(event) {
  events.emit('notification', event);
}

function subscribe(handler) {
  events.on('notification', handler);
  return () => events.off('notification', handler);
}

module.exports = { publish, subscribe };
