import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { errorMessage, isApiError } from "@/lib/api/errors";
import { routes } from "@/lib/routes";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useLocation, useNavigate } from "react-router";
import { z } from "zod";
import { useAuth } from "../auth-context";

const schema = z.object({
  email: z.string().trim().min(1, "Nhập email đăng nhập").email("Email chưa đúng định dạng"),
  password: z.string().min(1, "Nhập mật khẩu"),
});

type FormValues = z.infer<typeof schema>;
type LocationState = { from?: string } | null;

export function LoginPage() {
  const { login, logout, status, sessionMessage } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as LocationState)?.from ?? routes.dashboard();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
    mode: "onBlur",
  });

  if (status === "authenticated") return <Navigate to={from} replace />;

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      const user = await login(values.email, values.password);
      // No console role: keep the session? No — the only screen left would be the
      // 403 page, so drop the token and explain on the form instead.
      if (user.role === "ATTENDEE") {
        logout();
        setFormError("Tài khoản khách tham dự không có quyền dùng giao diện nhân sự.");
        return;
      }
      navigate(from, { replace: true });
    } catch (cause) {
      setFormError(
        isApiError(cause) && cause.code === "INVALID_CREDENTIALS"
          ? "Email hoặc mật khẩu không đúng."
          : errorMessage(isApiError(cause) ? cause.code : "UNKNOWN"),
      );
    }
  });

  const emailError = form.formState.errors.email?.message;
  const passwordError = form.formState.errors.password?.message;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            qE
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">qEvent</p>
            <p className="text-xs text-muted-foreground">Console vận hành sự kiện</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <h1 className="text-headline text-foreground">Đăng nhập</h1>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} noValidate>
              <FieldGroup>
                {sessionMessage ? (
                  <Alert className="bg-warning/10 text-warning">
                    <AlertDescription className="text-warning">{sessionMessage}</AlertDescription>
                  </Alert>
                ) : null}

                <Field data-invalid={Boolean(emailError)}>
                  <FieldLabel htmlFor="login-email">Email</FieldLabel>
                  <Input
                    id="login-email"
                    type="email"
                    autoComplete="username"
                    placeholder="ten@qevent.com"
                    aria-invalid={Boolean(emailError)}
                    {...form.register("email")}
                  />
                  <FieldError>{emailError}</FieldError>
                </Field>

                <Field data-invalid={Boolean(passwordError)}>
                  <FieldLabel htmlFor="login-password">Mật khẩu</FieldLabel>
                  <Input
                    id="login-password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    aria-invalid={Boolean(passwordError)}
                    {...form.register("password")}
                  />
                  <FieldError>{passwordError}</FieldError>
                </Field>

                {formError ? (
                  <Alert className="bg-destructive/5 text-destructive">
                    <AlertDescription className="text-destructive">{formError}</AlertDescription>
                  </Alert>
                ) : null}

                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting ? "Đang đăng nhập…" : "Đăng nhập"}
                </Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>

        {import.meta.env.DEV ? (
          <p className="mt-4 text-xs text-muted-foreground">
            Demo: organizer@qevent.com · password123
          </p>
        ) : null}
      </div>
    </main>
  );
}
