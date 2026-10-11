import { badgeState } from '../src/modules/streaks/Tiers';

describe('badge reveal gating', () => {
  it('keeps a newly reached badge locked until it is revealed', () => {
    // Streak 7 reaches Bronze (index 0); nothing revealed yet.
    expect(badgeState({ best: 7, signedIn: true, server: -1, phone: -1 })).toEqual({ shown: -1, pending: 0 });
  });

  it('shows it as earned once revealed, on any record', () => {
    expect(badgeState({ best: 7, signedIn: true, server: 0, phone: -1 })).toEqual({ shown: 0, pending: -1 });
    expect(badgeState({ best: 7, signedIn: true, server: -1, phone: 0 })).toEqual({ shown: 0, pending: -1 });
    expect(badgeState({ best: 7, signedIn: true, server: -1, phone: -1, memory: 0 })).toEqual({ shown: 0, pending: -1 });
  });

  it('never treats a missing server record as seen', () => {
    expect(badgeState({ best: 30, signedIn: true, server: undefined, phone: -1 })).toEqual({ shown: -1, pending: 1 });
  });

  it('reveals nothing while the phone record is still loading', () => {
    expect(badgeState({ best: 7, signedIn: true, server: -1, phone: undefined })).toEqual({ shown: -1, pending: -1 });
  });

  it('reveals only the newest badge and keeps older earned ones', () => {
    // Bronze already revealed, Silver (30) just reached.
    expect(badgeState({ best: 30, signedIn: true, server: 0, phone: 0 })).toEqual({ shown: 0, pending: 1 });
  });

  it('has nothing to reveal below the first badge', () => {
    expect(badgeState({ best: 6, signedIn: true, server: -1, phone: -1 })).toEqual({ shown: -1, pending: -1 });
  });
});
