const { CampusFixEventBus, EVENTS } = require('../../src/events/eventBus');

describe('CampusFixEventBus.emitAsync', () => {
  it('uses the four event names from the proposal', () => {
    expect(Object.values(EVENTS)).toEqual([
      'maintenanceRequestCreated',
      'requestAssigned',
      'requestStatusUpdated',
      'requestCompleted',
    ]);
  });

  it('waits for async listeners before resolving', async () => {
    const bus = new CampusFixEventBus();
    const order = [];
    bus.on('x', async () => {
      await new Promise((r) => setTimeout(r, 20));
      order.push('handler done');
    });
    await bus.emitAsync('x', {});
    order.push('after emit');
    expect(order).toEqual(['handler done', 'after emit']);
  });

  it('runs the other listeners and does not throw when one handler fails', async () => {
    const bus = new CampusFixEventBus();
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const ok = jest.fn();
    bus.on('x', () => { throw new Error('boom'); });
    bus.on('x', ok);

    const results = await bus.emitAsync('x', { id: 1 });

    expect(ok).toHaveBeenCalledWith({ id: 1 });
    expect(results.map((r) => r.status)).toEqual(['rejected', 'fulfilled']);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('still works with plain emit() for ordinary EventEmitter use', () => {
    const bus = new CampusFixEventBus();
    const fn = jest.fn();
    bus.on('y', fn);
    bus.emit('y', 42);
    expect(fn).toHaveBeenCalledWith(42);
  });
});
