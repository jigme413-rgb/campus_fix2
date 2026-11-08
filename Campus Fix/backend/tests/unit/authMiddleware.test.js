const { authorize } = require('../../src/middleware/auth');

describe('authorize()', () => {
  const run = (user, ...roles) => {
    const next = jest.fn();
    authorize(...roles)({ user }, {}, next);
    return next.mock.calls[0][0];
  };

  it('passes when the user has an allowed role', () => {
    expect(run({ role: 'admin' }, 'admin')).toBeUndefined();
    expect(run({ role: 'maintenance' }, 'maintenance', 'admin')).toBeUndefined();
  });

  it('T4: returns 403 for the wrong role', () => {
    expect(run({ role: 'student' }, 'admin').status).toBe(403);
  });

  it('returns 401 when there is no user', () => {
    expect(run(undefined, 'admin').status).toBe(401);
  });
});
