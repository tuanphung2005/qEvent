import { zodResolver } from '@hookform/resolvers/zod';
import { router, type Href } from 'expo-router';
import { EyeIcon, EyeOffIcon, LockIcon, MailIcon, QrCodeIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, View } from 'react-native';
import { z } from 'zod';

import { ApiError } from '@/api/errors';
import { isStaffRole } from '@/api/types';
import { useAuth } from '@/auth/auth-context';
import { Screen } from '@/components/screen';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';

const schema = z.object({
  email: z.email('Email không hợp lệ'),
  password: z.string().min(1, 'Nhập mật khẩu'),
});

type FormValues = z.infer<typeof schema>;

export default function LoginScreen() {
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const user = await login(values.email, values.password);
      const target = isStaffRole(user.role) ? '/(staff)/events' : '/(attendee)/tickets';
      router.replace(target as Href);
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? error.message
          : 'Không thể đăng nhập. Kiểm tra kết nối mạng rồi thử lại.'
      );
    }
  });

  return (
    <Screen scroll contentClassName="justify-center gap-6 py-8">
      <View className="items-center gap-3">
        <View className="size-14 items-center justify-center rounded-card bg-primary">
          <Icon as={QrCodeIcon} className="size-7 text-primary-foreground" />
        </View>
        <Text className="text-display text-foreground">qEvent</Text>
        <Text className="text-center text-body text-muted-foreground">
          Vé của bạn và cổng soát vé, trong một ứng dụng.
        </Text>
      </View>

      <Card className="rounded-card border-0 shadow-none">
        <CardHeader>
          <CardTitle className="text-title">Đăng nhập</CardTitle>
          <CardDescription>Dùng tài khoản attendee hoặc staff/organizer.</CardDescription>
        </CardHeader>
        <CardContent className="gap-4">
          {formError ? (
            <Alert icon={LockIcon} variant="destructive" className="border-0 bg-destructive/10">
              <AlertTitle>Đăng nhập thất bại</AlertTitle>
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          ) : null}

          <View className="gap-2">
            <Label htmlFor="email">Email</Label>
            <View className="relative justify-center">
              <View className="absolute left-3 z-10">
                <Icon as={MailIcon} className="size-4 text-muted-foreground" />
              </View>
              <Controller
                control={control}
                name="email"
                render={({ field }) => (
                  <Input
                    id="email"
                    accessibilityLabel="Email"
                    className="h-12 border-0 bg-secondary pl-10 text-body"
                    placeholder="ban@example.com"
                    autoCapitalize="none"
                    autoComplete="email"
                    keyboardType="email-address"
                    autoCorrect={false}
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    editable={!isSubmitting}
                  />
                )}
              />
            </View>
            {errors.email ? (
              <Text className="text-label text-destructive-strong">{errors.email.message}</Text>
            ) : null}
          </View>

          <View className="gap-2">
            <Label htmlFor="password">Mật khẩu</Label>
            <View className="justify-center">
              <Controller
                control={control}
                name="password"
                render={({ field }) => (
                  <Input
                    id="password"
                    accessibilityLabel="Mật khẩu"
                    className="h-12 border-0 bg-secondary pr-12 text-body"
                    placeholder="Nhập mật khẩu"
                    secureTextEntry={!showPassword}
                    autoComplete="current-password"
                    value={field.value}
                    onChangeText={field.onChange}
                    onBlur={field.onBlur}
                    editable={!isSubmitting}
                    onSubmitEditing={onSubmit}
                    returnKeyType="go"
                  />
                )}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                className="absolute right-0 h-12 w-12 items-center justify-center"
                onPress={() => setShowPassword((value) => !value)}>
                <Icon
                  as={showPassword ? EyeOffIcon : EyeIcon}
                  className="size-5 text-muted-foreground"
                />
              </Pressable>
            </View>
            {errors.password ? (
              <Text className="text-label text-destructive-strong">{errors.password.message}</Text>
            ) : null}
          </View>

          <Button
            size="lg"
            className="mt-2 h-12 rounded-control"
            disabled={isSubmitting}
            onPress={onSubmit}>
            <Text>{isSubmitting ? 'Đang đăng nhập…' : 'Đăng nhập'}</Text>
          </Button>
        </CardContent>
      </Card>

      <Text className="text-center text-label text-muted-foreground">
        Host dùng web console. App mobile chỉ dành cho attendee và staff soát vé.
      </Text>
    </Screen>
  );
}
