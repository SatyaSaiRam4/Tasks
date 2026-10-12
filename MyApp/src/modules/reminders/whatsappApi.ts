import { baseApi } from '../../api/baseApi';

/**
 * NONE: never asked · PENDING: asked, inside the 1-minute answer window ·
 * EXPIRED: no answer in time · VERIFIED: tapped 👍 / said YES · STOPPED: tapped 👎 / said STOP.
 */
export type ContactStatus = 'NONE' | 'PENDING' | 'EXPIRED' | 'VERIFIED' | 'STOPPED';

export interface ContactInfo {
  phone: string;
  status: ContactStatus;
  /** When the "reply YES to allow" message was sent (once a day at most). */
  asked_at: string | null;
  /** When the 1-minute answer window closes (while PENDING). */
  expires_at: string | null;
  /** Refusals (👎 / STOP) today; after 3 it can be asked again only at `try_again_at`. */
  refusals_today: number;
  try_again_at: string | null;
  /** Memo's WhatsApp number, digits only. */
  business_number: string;
  /** The last message from this number that reached the server, if any. */
  last_reply: string | null;
  last_reply_at: string | null;
}

/** WhatsApp consent: a number gets reminders only once its owner has replied YES. */
export const whatsappApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    whatsappStatus: builder.query<ContactInfo, string>({
      query: phone => ({ url: '/whatsapp/status', params: { phone } }),
      keepUnusedDataFor: 0,
    }),
    askWhatsappPermission: builder.mutation<ContactInfo, string>({
      query: phone => ({ url: '/whatsapp/verify', method: 'POST', body: { phone } }),
    }),
  }),
});

export const { useWhatsappStatusQuery, useAskWhatsappPermissionMutation } = whatsappApi;
