import { baseApi } from '../../api/baseApi';

/** NONE: never asked · PENDING: asked, waiting for YES · VERIFIED: said YES · STOPPED: said STOP. */
export type ContactStatus = 'NONE' | 'PENDING' | 'VERIFIED' | 'STOPPED';

export interface ContactInfo {
  phone: string;
  status: ContactStatus;
  /** When the "reply YES to allow" message was sent (once a day at most). */
  asked_at: string | null;
  /** Memo's WhatsApp number, digits only. */
  business_number: string;
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
