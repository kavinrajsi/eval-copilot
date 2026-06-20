"use client";

import Link from "next/link";
import { useActionState } from "react";

import { authenticate } from "@/app/login/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";

export function SignupForm({ ...props }) {
  const [state, formAction, pending] = useActionState(authenticate, null);

  return (
    <Card {...props}>
      <CardHeader>
        <CardTitle>Create an account</CardTitle>
        <CardDescription>
          Enter your information below to create your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction}>
          <input type="hidden" name="intent" value="signup" />
          <FieldGroup>
            {state?.error ? (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            ) : null}
            {state?.message ? (
              <Alert>
                <AlertDescription>{state.message}</AlertDescription>
              </Alert>
            ) : null}
            <Field>
              <FieldLabel htmlFor="name">Full Name</FieldLabel>
              <Input
                id="name"
                name="name"
                type="text"
                placeholder="John Doe"
                autoComplete="name"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="m@example.com"
                autoComplete="email"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <PasswordInput
                id="password"
                name="password"
                autoComplete="new-password"
                minLength={6}
                required
              />
              <FieldDescription>
                Must be at least 6 characters long.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="confirm-password">Confirm Password</FieldLabel>
              <PasswordInput
                id="confirm-password"
                name="confirm"
                autoComplete="new-password"
                minLength={6}
                required
              />
              <FieldDescription>Please confirm your password.</FieldDescription>
            </Field>
            <Field>
              <Button type="submit" disabled={pending}>
                {pending ? "Creating account…" : "Create Account"}
              </Button>
              <FieldDescription className="px-6 text-center">
                Already have an account? <Link href="/login">Sign in</Link>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
