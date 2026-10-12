import { baseApi } from '../../api/baseApi';

export type ContactStatus = 'NONE' | 'PENDING' | 'VERIFIED' | 'STOPPED';

export interface VerifyStart {
  phone: string;
  status: ContactStatus;
  /** The code and the ready-made message ("MEMO 123456"); null if already verified. */
  code: string | null;
  message: string | null;
  /** wa.me link that opens WhatsApp with the message to Memo's number. */
  link: string | null;
  business_number: string;
  expires_at: string | null;
}

/** WhatsApp consent: a number gets reminders only once its owner has sent Memo the code from it. */
export const whatsappApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    whatsappStatus: builder.query<{ phone: string; status: ContactStatus }, string>({
      query: phone => ({ url: '/whatsapp/status', params: { phone } }),
      keepUnusedDataFor: 0,
    }),
    startWhatsappVerification: builder.mutation<VerifyStart, string>({
      query: phone => ({ url: '/whatsapp/verify', method: 'POST', body: { phone } }),
    }),
  }),
});

export const { useWhatsappStatusQuery, useStartWhatsappVerificationMutation } = whatsappApi;
