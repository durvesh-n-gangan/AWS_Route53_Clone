import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import SpaceBetween from "@cloudscape-design/components/space-between";
import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "@/components/auth/LoginForm";

import styles from "./login.module.css";

export const metadata: Metadata = { title: { absolute: "Amazon Web Services Sign-In" } };

export default function LoginPage() {
  return (
    <main className={styles.page}>
      <div className={styles.column}>
        <SpaceBetween size="l">
          <div className={styles.mark} aria-label="Console sign-in">
            aws
          </div>
          {/* useSearchParams (for ?redirect=) needs a Suspense boundary when prerendered. */}
          <Suspense>
            <LoginForm />
          </Suspense>
          <Alert type="info" header="Demo credentials">
            IAM user name <strong>admin</strong>, password <strong>admin123</strong>.
          </Alert>
          <Box fontSize="body-s" color="text-body-secondary" textAlign="center">
            Educational project. Not affiliated with, endorsed by, or connected to Amazon Web
            Services. AWS and Route 53 are trademarks of Amazon.com, Inc. or its affiliates.
          </Box>
        </SpaceBetween>
      </div>
    </main>
  );
}
