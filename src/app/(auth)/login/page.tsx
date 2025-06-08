import { AuthLayout } from '@/components/layout/AuthLayout';
import { LoginForm } from '@/components/forms/LoginForm';

export default function LoginPage() {
  return (
    <AuthLayout 
      title="Welcome Back!"
      description="Log in to manage your invoices."
    >
      <LoginForm />
    </AuthLayout>
  );
}
