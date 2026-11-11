const v = require('../../src/utils/validators');

describe('validateRegistration', () => {
  const good = { name: 'Tashi Dorji', email: 'Tashi@Sherubtse.edu.bt', password: 'Password1' };

  it('accepts valid input, lowercases email and defaults role to student', () => {
    const r = v.validateRegistration(good);
    expect(r.valid).toBe(true);
    expect(r.value.email).toBe('tashi@sherubtse.edu.bt');
    expect(r.value.role).toBe('student');
  });

  it('rejects weak passwords and bad emails with field names', () => {
    const r = v.validateRegistration({ ...good, email: 'nope', password: 'short' });
    expect(r.valid).toBe(false);
    expect(r.errors.map((e) => e.field)).toEqual(expect.arrayContaining(['email', 'password']));
  });

  it('does not let the public register as admin or maintenance', () => {
    expect(v.validateRegistration({ ...good, role: 'admin' }).valid).toBe(false);
    expect(v.validateRegistration({ ...good, role: 'maintenance' }).valid).toBe(false);
  });

  it('allows any role when the caller (an admin) widens allowedRoles', () => {
    expect(v.validateRegistration({ ...good, role: 'maintenance' }, { allowedRoles: v.ROLES }).valid).toBe(true);
  });
});

describe('validateRequest', () => {
  const good = { title: 'Leaking tap', description: 'Tap leaks all night', location: 'Hostel 2', category_id: '3' };

  it('accepts a valid request, trims text and defaults priority to Medium', () => {
    const r = v.validateRequest({ ...good, title: '  Leaking tap  ' });
    expect(r.valid).toBe(true);
    expect(r.value).toMatchObject({ title: 'Leaking tap', category_id: 3, priority: 'Medium' });
  });

  it('T2: reports a missing title', () => {
    const r = v.validateRequest({ ...good, title: '' });
    expect(r.valid).toBe(false);
    expect(r.errors[0]).toEqual({ field: 'title', message: expect.any(String) });
  });

  it('rejects an unknown priority and an invalid category', () => {
    const r = v.validateRequest({ ...good, priority: 'Whenever', category_id: 'abc' });
    expect(r.errors.map((e) => e.field).sort()).toEqual(['category_id', 'priority']);
  });

  it('partial mode only validates the fields that were sent', () => {
    expect(v.validateRequest({ location: 'Library' }, { partial: true }).valid).toBe(true);
    expect(v.validateRequest({}, { partial: true }).valid).toBe(false);
  });
});

describe('validateStatus', () => {
  it('accepts the four proposal statuses only', () => {
    v.STATUSES.forEach((s) => expect(v.validateStatus({ status: s }).valid).toBe(true));
    expect(v.validateStatus({ status: 'Done' }).valid).toBe(false);
  });
});

describe('canTransition (FR6 workflow rules)', () => {
  it('lets maintenance staff move work forward one step at a time', () => {
    expect(v.canTransition('maintenance', 'Assigned', 'In Progress')).toBe(true);
    expect(v.canTransition('maintenance', 'In Progress', 'Completed')).toBe(true);
    expect(v.canTransition('maintenance', 'Assigned', 'Completed')).toBe(false);
    expect(v.canTransition('maintenance', 'Completed', 'Pending')).toBe(false);
  });

  it('lets admins move to any different status', () => {
    expect(v.canTransition('admin', 'Completed', 'Pending')).toBe(true);
    expect(v.canTransition('admin', 'Pending', 'Pending')).toBe(false);
  });

  it('never lets reporters change status', () => {
    expect(v.canTransition('student', 'Pending', 'Completed')).toBe(false);
    expect(v.canTransition('staff', 'Assigned', 'In Progress')).toBe(false);
  });
});

describe('isPositiveInt', () => {
  it.each([[1, true], ['7', true], [0, false], [-2, false], ['1.5', false], ['', false], [null, false], [true, false]])(
    '%p -> %p',
    (input, expected) => expect(v.isPositiveInt(input)).toBe(expected)
  );
});
