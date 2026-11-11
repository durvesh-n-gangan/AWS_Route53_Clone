import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "@/components/auth/LoginForm";

import styles from "./login.module.css";

export const metadata: Metadata = { title: { absolute: "Amazon Web Services Sign-In" } };

export default function LoginPage() {
  return (
    <main className={styles.page}>
      <div className={styles.topBar} aria-hidden>
        <span>English</span>
      </div>
      <div className={styles.mark} aria-label="Console sign-in">
        aws
      </div>
      <div className={styles.content}>
        <div className={styles.cardColumn}>
          <div className={styles.card}>
            {/* useSearchParams (for ?redirect=) needs a Suspense boundary when prerendered. */}
            <Suspense>
              <LoginForm />
            </Suspense>
          </div>
          <p className={styles.legal}>
            This console is a demonstration. Accounts, users and sign-in are mocked; nothing is
            sent to AWS.
          </p>
        </div>
        <section className={styles.panel} aria-label="About this demo">
          <h2 className={styles.panelTitle}>Route 53 console clone</h2>
          <p className={styles.panelText}>
            Manage hosted zones and DNS records in a console that looks and works like Route 53.
          </p>
          <p className={styles.panelCreds}>
            Demo sign-in: IAM user name <strong>admin</strong>, password <strong>admin123</strong>.
          </p>
        </section>
      </div>
      <footer className={styles.footer}>
        Educational project. Not affiliated with, endorsed by, or connected to Amazon Web Services.
        AWS and Route 53 are trademarks of Amazon.com, Inc. or its affiliates.
      </footer>
    </main>
  );
}
