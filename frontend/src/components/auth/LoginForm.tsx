"use client";

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Tiles from "@cloudscape-design/components/tiles";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import styles from "@/app/login/login.module.css";
import { ApiError } from "@/lib/api/client";
import { safeRedirectTarget } from "@/lib/auth/session";
import { useLogin } from "@/lib/queries/auth";

/** The single mocked AWS account this demo signs in to (matches the backend seed). */
export const DEMO_ACCOUNT_ID = process.env.NEXT_PUBLIC_DEMO_ACCOUNT_ID ?? "123456789012";

type UserType = "root" | "iam";

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
  const [userType, setUserType] = useState<UserType>("iam");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (userType !== "iam") return;
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
      <SpaceBetween size="m">
        <SpaceBetween size="xxs">
          <Box variant="h1" fontSize="heading-m" padding="n">
            Sign In
          </Box>
          <Box variant="p" padding="n" fontSize="body-s">
            Access your AWS account by user type.
          </Box>
        </SpaceBetween>
        {errorMessage && (
          <Alert type="error" header="There was a problem">
            {errorMessage}
          </Alert>
        )}
        <FormField label="User type">
          <Tiles
            columns={1}
            value={userType}
            onChange={({ detail }) => setUserType(detail.value as UserType)}
            ariaLabel="User type"
            items={[
              {
                value: "root",
                label: "Root user",
                description: "Root sign-in isn't available in this demo.",
              },
              {
                value: "iam",
                label: "IAM user",
                description: "User within an account that performs daily tasks.",
              },
            ]}
          />
        </FormField>
        {userType === "iam" ? (
          <>
            <FormField label="Account ID (12 digits) or account alias">
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
          </>
        ) : (
          <Alert type="info">Choose IAM user to sign in to the demo account.</Alert>
        )}
        <button
          type="submit"
          className={styles.primary}
          disabled={login.isPending || userType !== "iam"}
        >
          {login.isPending ? "Signing in…" : "Sign in"}
        </button>
        <div className={styles.divider}>OR</div>
        <button type="button" className={styles.secondary} disabled>
          New to AWS? Sign up
        </button>
      </SpaceBetween>
    </form>
  );
}
