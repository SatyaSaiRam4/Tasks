/** The part of react-native-razorpay Memo uses (the package ships no types for its entry file). */
declare module 'react-native-razorpay' {
  const RazorpayCheckout: {
    /** Opens Razorpay's checkout; resolves with the payment ids and signature, rejects with { code, description }. */
    open(options: Record<string, unknown>): Promise<{
      razorpay_payment_id: string;
      razorpay_order_id?: string;
      razorpay_signature?: string;
    }>;
  };
  export default RazorpayCheckout;
}
