import { AuthLayout } from '@/components/layout/AuthLayout';
import { SignupForm } from '@/components/forms/SignupForm';

export default function SignupPage() {
  return (
    <AuthLayout
      title="Create your BillFlow Account"
      description="Join us to simplify your invoicing."
    >
      <SignupForm />
    </AuthLayout>
  );
}
