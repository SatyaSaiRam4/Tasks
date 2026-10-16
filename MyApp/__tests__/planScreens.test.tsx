/**
 * The WhatsApp plan and wallet screens against a fake server (fetch is
 * mocked) and a fake Razorpay checkout: what's shown in each state, what's
 * sent, and that the app never decides a payment on its own.
 */
import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text, TurboModuleRegistry } from 'react-native';
import { Provider as ReduxProvider } from 'react-redux';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import RazorpayCheckout from 'react-native-razorpay';
import { store } from '../src/app/store';
import { baseApi } from '../src/api/baseApi';
import { Button } from '../src/components/Button';
import { TextField } from '../src/components/TextField';
import { WhatsAppPlanScreen } from '../src/modules/subscriptions/screens/WhatsAppPlanScreen';
import { WalletScreen } from '../src/modules/wallet/screens/WalletScreen';

jest.mock('@ant-design/react-native/lib/toast', () => ({ success: jest.fn(), fail: jest.fn(), info: jest.fn() }));
// Buying is switched off in the Play build (PLAN_PURCHASE_ENABLED); these tests switch it per test.
let mockPlanSales = true;
jest.mock('../src/config/env', () => {
  const actual = jest.requireActual('../src/config/env');
  return {
    ...actual,
    get PLAN_PURCHASE_ENABLED() {
      return mockPlanSales;
    },
  };
});
jest.mock('../src/notifications', () => ({ initNotifications: jest.fn().mockResolvedValue(undefined) }));
jest.mock('react-native-webview', () => {
  const ReactLib = require('react');
  const { View } = require('react-native');
  return { WebView: (props: any) => ReactLib.createElement(View, props, props.children) };
});
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { addEventListener: jest.fn(() => jest.fn()), fetch: jest.fn().mockResolvedValue({ isConnected: true }) },
}));

const PLAN = {
  free_total: 3,
  free_used: 3,
  free_remaining: 0,
  plan_status: 'NONE',
  paid_remaining: 0,
  plan_messages_total: 0,
  plan_messages_used: 0,
  plan_starts_at: null,
  plan_expires_at: null,
  purchase_required: true,
  payments_enabled: true,
  payments_mode: 'test',
  price_paise: 3000,
  currency: 'INR',
  plan_messages: 100,
  plan_days: 30,
  pending_order_id: null,
};
const ACTIVE = { ...PLAN, plan_status: 'ACTIVE', paid_remaining: 100, plan_messages_total: 100, purchase_required: false, plan_starts_at: '2026-10-16T10:00:00Z', plan_expires_at: '2026-11-15T10:00:00Z' };
const ORDER = { order_id: 'order_T1', key_id: 'rzp_test_KEY', amount_paise: 3000, currency: 'INR', name: 'Memo', description: 'WhatsApp plan', prefill_email: 'a@b.c', prefill_name: 'A', mode: 'test' };

type Route = (body: any) => { status?: number; json: unknown };
let routes: Record<string, Route> = {};
let calls: { method: string; path: string; body: any }[] = [];

beforeEach(() => {
  calls = [];
  routes = {};
  store.dispatch(baseApi.util.resetApiState());
  jest.spyOn(globalThis, 'fetch').mockImplementation(async (input: any, init?: any) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const path = new URL(request.url).pathname.replace('/api/v1', '');
    const text = request.method === 'GET' ? '' : await request.text();
    const body = text ? JSON.parse(text) : undefined;
    calls.push({ method: request.method, path, body });
    const route = routes[`${request.method} ${path}`];
    const res = route ? route(body) : { status: 404, json: { error: { code: 'NOTFOUND', message: 'Not found' } } };
    return new Response(JSON.stringify(res.json), { status: res.status ?? 200, headers: { 'Content-Type': 'application/json' } });
  });
});

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];
afterEach(async () => {
  // Unmount every screen so its timers stop (polling, animations).
  while (mounted.length) {
    const root = mounted.pop()!;
    await act(async () => root.unmount());
  }
  jest.restoreAllMocks();
});

const Stack = createNativeStackNavigator();
async function render(Screen: React.ComponentType) {
  let root!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    root = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
        <ReduxProvider store={store}>
          <NavigationContainer>
            <Stack.Navigator>
              <Stack.Screen name="Test" component={Screen} options={{ headerShown: false }} />
            </Stack.Navigator>
          </NavigationContainer>
        </ReduxProvider>
      </SafeAreaProvider>,
    );
  });
  mounted.push(root);
  await flush();
  return root;
}

async function flush() {
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await new Promise<void>(r => setTimeout(() => r(), 20)); // one animation frame: Redux batches updates on frames
    });
  }
}

function texts(root: ReactTestRenderer.ReactTestRenderer): string {
  return root.root
    .findAllByType(Text)
    .map(t => [t.props.children].flat(Infinity).filter(c => typeof c === 'string' || typeof c === 'number').join(''))
    .join(' | ');
}

function button(root: ReactTestRenderer.ReactTestRenderer, label: string | RegExp) {
  return root.root.findAllByType(Button).find(b => (typeof label === 'string' ? b.props.label === label : label.test(b.props.label)))!;
}

describe('WhatsApp plan screen', () => {
  beforeEach(() => {
    mockPlanSales = true;
  });

  it('in a build that can’t sell the plan: no price, no payment, just "coming soon"', async () => {
    mockPlanSales = false;
    routes['GET /subscriptions/whatsapp'] = () => ({ json: PLAN });
    const root = await render(WhatsAppPlanScreen);
    const shown = texts(root);
    expect(shown).toContain('Your 3 free WhatsApp reminders are used. More WhatsApp reminders are coming soon.');
    expect(shown).toContain('WhatsApp plan coming soon');
    expect(shown).not.toContain('₹30');
    expect(shown).not.toContain('Razorpay');
    expect(root.root.findAllByType(Button).some(b => /plan|Renew|Payments/.test(b.props.label))).toBe(false);
  });

  it('explains that the free reminders are used and what the plan is', async () => {
    routes['GET /subscriptions/whatsapp'] = () => ({ json: PLAN });
    const root = await render(WhatsAppPlanScreen);
    const shown = texts(root);
    expect(shown).toContain('Your 3 free WhatsApp reminders are used. The plan is ₹30 for 100 WhatsApp reminders over 30 days.');
    expect(shown).toContain('Test mode: no real money is charged.');
    expect(button(root, 'Get the plan for ₹30').props.disabled).toBe(false);
  });

  it('can’t be bought until payments are set up on the server', async () => {
    routes['GET /subscriptions/whatsapp'] = () => ({ json: { ...PLAN, payments_enabled: false } });
    const root = await render(WhatsAppPlanScreen);
    expect(button(root, 'Payments coming soon').props.disabled).toBe(true);
  });

  it('shows an error with a retry when the server can’t be reached', async () => {
    routes['GET /subscriptions/whatsapp'] = () => ({ status: 500, json: { error: { code: 'X', message: 'Server down' } } });
    const root = await render(WhatsAppPlanScreen);
    expect(texts(root)).toMatch(/Server down|Couldn’t load/);
  });

  it('pays through Razorpay and shows the plan only after the server confirms it', async () => {
    jest.spyOn(TurboModuleRegistry, 'get').mockReturnValue({} as any);
    let confirmed = false;
    routes['GET /subscriptions/whatsapp'] = () => ({ json: confirmed ? ACTIVE : PLAN });
    routes['POST /subscriptions/whatsapp/order'] = () => ({ json: ORDER });
    routes['POST /subscriptions/whatsapp/verify'] = () => {
      confirmed = true;
      return { json: { state: 'PAID', plan: ACTIVE } };
    };
    (RazorpayCheckout.open as jest.Mock).mockResolvedValueOnce({
      razorpay_order_id: 'order_T1',
      razorpay_payment_id: 'pay_T1',
      razorpay_signature: 'f'.repeat(64),
    });
    const root = await render(WhatsAppPlanScreen);
    await act(async () => button(root, 'Get the plan for ₹30').props.onPress());
    await flush();

    // Razorpay got the server's order and price; the server got Razorpay's ids only.
    expect((RazorpayCheckout.open as jest.Mock).mock.calls[0][0]).toMatchObject({ key: 'rzp_test_KEY', order_id: 'order_T1', amount: 3000 });
    expect(calls.find(c => c.path === '/subscriptions/whatsapp/order')!.body).toBeUndefined();
    expect(calls.find(c => c.path === '/subscriptions/whatsapp/verify')!.body).toEqual({
      razorpay_order_id: 'order_T1',
      razorpay_payment_id: 'pay_T1',
      razorpay_signature: 'f'.repeat(64),
    });
    const shown = texts(root);
    expect(shown).toContain('Payment confirmed. Your WhatsApp plan is active.');
    expect(shown).toContain('Messages left');
  });

  it('says nothing was charged when the checkout is closed', async () => {
    jest.spyOn(TurboModuleRegistry, 'get').mockReturnValue({} as any);
    routes['GET /subscriptions/whatsapp'] = () => ({ json: PLAN });
    routes['POST /subscriptions/whatsapp/order'] = () => ({ json: ORDER });
    (RazorpayCheckout.open as jest.Mock).mockRejectedValueOnce({ code: 0, description: 'Payment cancelled by user' });
    const root = await render(WhatsAppPlanScreen);
    await act(async () => button(root, 'Get the plan for ₹30').props.onPress());
    await flush();
    expect(texts(root)).toContain('Payment cancelled. Nothing was charged.');
    expect(calls.some(c => c.path === '/subscriptions/whatsapp/verify')).toBe(false);
  });

  it('waits for Razorpay when the server can’t confirm yet', async () => {
    jest.spyOn(TurboModuleRegistry, 'get').mockReturnValue({} as any);
    routes['GET /subscriptions/whatsapp'] = () => ({ json: PLAN });
    routes['POST /subscriptions/whatsapp/order'] = () => ({ json: ORDER });
    routes['POST /subscriptions/whatsapp/verify'] = () => ({ json: { state: 'PENDING', plan: { ...PLAN, pending_order_id: 'order_T1' } } });
    (RazorpayCheckout.open as jest.Mock).mockResolvedValueOnce({ razorpay_order_id: 'order_T1', razorpay_payment_id: 'pay_T1', razorpay_signature: 'a'.repeat(64) });
    const root = await render(WhatsAppPlanScreen);
    await act(async () => button(root, 'Get the plan for ₹30').props.onPress());
    await flush();
    expect(texts(root)).toContain('Waiting for Razorpay to confirm the payment.');
    expect(texts(root)).not.toContain('Payment confirmed');
  });

  it('says payments need the latest app when checkout isn’t in this build', async () => {
    routes['GET /subscriptions/whatsapp'] = () => ({ json: PLAN });
    routes['POST /subscriptions/whatsapp/order'] = () => ({ json: ORDER });
    const root = await render(WhatsAppPlanScreen);
    await act(async () => button(root, 'Get the plan for ₹30').props.onPress());
    await flush();
    expect(texts(root)).toContain('Payments need the latest version of the app.');
  });
});

describe('wallet screen', () => {
  const WALLET = {
    best_streak: 1000,
    live_best_streak: 1000,
    earned: 30,
    redeemed: 0,
    balance: 30,
    points_unlocked: 1500,
    points_redeemed: 0,
    points_available: 1500,
    choices: [
      { points: 500, amount: 10, available: true },
      { points: 1000, amount: 20, available: true },
    ],
    milestones: [
      { days: 500, amount: 10, points: 500, reached: true },
      { days: 1000, amount: 20, points: 1000, reached: true },
    ],
    redemptions: [
      { id: 'r1', amount: 10, points: 500, phone: '+919876543210', status: 'PAID', payout_reference: 'UPI-77', note: null, decided_at: null, created_at: '2026-10-10T10:00:00Z' },
      { id: 'r2', amount: 20, points: 1000, phone: '+919876543210', status: 'REJECTED', payout_reference: null, note: 'Wrong number', decided_at: null, created_at: '2026-10-11T10:00:00Z' },
    ],
  };

  it('shows points, the two choices and each redemption’s status', async () => {
    routes['GET /wallet'] = () => ({ json: WALLET });
    const root = await render(WalletScreen);
    const shown = texts(root);
    expect(shown).toContain('1500');
    expect(shown).toContain('500 points');
    expect(shown).toContain('1000 points');
    expect(shown).toContain('Paid');
    expect(shown).toContain('Not paid');
  });

  it('sends the chosen points with a request id, and only once while it’s sending', async () => {
    routes['GET /wallet'] = () => ({ json: WALLET });
    let release!: () => void;
    const gate = new Promise<void>(r => (release = () => r()));
    routes['POST /wallet/redeem'] = body => ({ status: 201, json: { ...WALLET.redemptions[0], id: 'r3', status: 'PENDING', points: body.points, amount: 10 } });
    const root = await render(WalletScreen);
    const choice = root.root.findAll(n => n.props.accessibilityRole === 'radio' && n.props.accessibilityLabel?.startsWith('500 points'))[0];
    await act(async () => choice.props.onPress());
    await act(async () => root.root.findAllByType(TextField).find(f => /Mobile number/.test(f.props.label))!.props.onChangeText('9876543210'));
    const redeemButton = button(root, 'Redeem ₹10');
    expect(redeemButton.props.disabled).toBe(false);
    await act(async () => {
      redeemButton.props.onPress();
      redeemButton.props.onPress(); // a double tap
      release();
      await gate;
    });
    await flush();
    const sent = calls.filter(c => c.path === '/wallet/redeem');
    expect(sent).toHaveLength(1);
    expect(sent[0].body).toMatchObject({ phone: '9876543210', points: 500 });
    expect(sent[0].body.request_id).toMatch(/^r[a-z0-9]{8,}$/);
  });
});

// Clear the API cache so its timers (unused data is kept 5 minutes) don't outlive the tests.
afterAll(async () => {
  store.dispatch(baseApi.util.resetApiState());
  // Let Redux's last batched update (scheduled on an animation frame) run before Jest tears down.
  await new Promise<void>(resolve => setTimeout(() => resolve(), 100));
});
