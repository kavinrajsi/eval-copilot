"use client";

import { useActionState } from "react";

import { changePassword, updateProfile } from "./actions";
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

// Surfaces the action result as an inline alert — error (destructive) or
// confirmation (default), matching the auth forms' feedback pattern.
function FormStatus({ state }) {
  if (state?.error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{state.error}</AlertDescription>
      </Alert>
    );
  }
  if (state?.ok) {
    return (
      <Alert>
        <AlertDescription>{state.message}</AlertDescription>
      </Alert>
    );
  }
  return null;
}

export function ProfileForm({ fullName, email }) {
  const [state, formAction, pending] = useActionState(updateProfile, null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>The name shown across your workspace.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction}>
          <FieldGroup>
            <FormStatus state={state} />
            <Field>
              <FieldLabel htmlFor="full_name">Display name</FieldLabel>
              <Input
                key={fullName}
                id="full_name"
                name="full_name"
                defaultValue={fullName}
                placeholder="Your name"
                autoComplete="name"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input id="email" value={email} readOnly disabled />
              <FieldDescription>
                Email changes aren&apos;t supported yet.
              </FieldDescription>
            </Field>
            <Field>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save changes"}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

export function PasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
        <CardDescription>Use at least 6 characters.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction}>
          <FieldGroup>
            <FormStatus state={state} />
            <Field>
              <FieldLabel htmlFor="password">New password</FieldLabel>
              <PasswordInput
                id="password"
                name="password"
                autoComplete="new-password"
                minLength={6}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="confirm">Confirm new password</FieldLabel>
              <PasswordInput
                id="confirm"
                name="confirm"
                autoComplete="new-password"
                minLength={6}
                required
              />
            </Field>
            <Field>
              <Button type="submit" disabled={pending}>
                {pending ? "Updating…" : "Update password"}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
