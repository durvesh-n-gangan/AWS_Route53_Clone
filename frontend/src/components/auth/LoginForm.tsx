"use client";

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import Input from "@cloudscape-design/components/input";
import Link from "@cloudscape-design/components/link";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { ApiError } from "@/lib/api/client";
import { safeRedirectTarget } from "@/lib/auth/session";
import { useLogin } from "@/lib/queries/auth";

/** The single mocked AWS account this demo signs in to (matches the backend seed). */
export const DEMO_ACCOUNT_ID = process.env.NEXT_PUBLIC_DEMO_ACCOUNT_ID ?? "123456789012";

interface FieldErrors {
  username?: string;
  password?: string;
}

function validate(username: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!username.trim()) errors.username = "Enter your IAM user name.";
  if (!password) errors.password = "Enter your password.";
  return errors;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useLogin();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const errors = validate(username, password);
    setFieldErrors(errors);
    if (errors.username || errors.password) return;

    login.mutate(
      { username: username.trim(), password },
      {
        onSuccess: () => router.replace(safeRedirectTarget(searchParams.get("redirect"))),
        onError: () => setPassword(""),
      },
    );
  };

  const errorMessage =
    login.error instanceof ApiError
      ? login.error.message
      : login.error
        ? "Something went wrong. Try again."
        : null;

  return (
    <form onSubmit={onSubmit} noValidate>
      <Container header={<Header variant="h1">Sign in as IAM user</Header>}>
        <Form
          actions={
            <Button variant="primary" formAction="submit" fullWidth loading={login.isPending}>
              Sign in
            </Button>
          }
        >
          <SpaceBetween size="l">
            {errorMessage && (
              <Alert type="error" header="There was a problem">
                {errorMessage}
              </Alert>
            )}
            <FormField
              label="Account ID (12 digits) or account alias"
              description="This demo has a single mocked account."
            >
              <Input value={DEMO_ACCOUNT_ID} readOnly ariaLabel="Account ID" />
            </FormField>
            <FormField label="IAM user name" errorText={fieldErrors.username}>
              <Input
                value={username}
                autoComplete="username"
                autoFocus
                onChange={({ detail }) => setUsername(detail.value)}
              />
            </FormField>
            <FormField label="Password" errorText={fieldErrors.password}>
              <Input
                type="password"
                value={password}
                autoComplete="current-password"
                onChange={({ detail }) => setPassword(detail.value)}
              />
            </FormField>
            <Box color="text-body-secondary" fontSize="body-s">
              <SpaceBetween size="xxs">
                <Link
                  variant="secondary"
                  fontSize="body-s"
                  href="#"
                  onFollow={(event) => event.preventDefault()}
                >
                  Sign in using root user email
                </Link>
                <Link
                  variant="secondary"
                  fontSize="body-s"
                  href="#"
                  onFollow={(event) => event.preventDefault()}
                >
                  Forgot password?
                </Link>
              </SpaceBetween>
            </Box>
          </SpaceBetween>
        </Form>
      </Container>
    </form>
  );
}
