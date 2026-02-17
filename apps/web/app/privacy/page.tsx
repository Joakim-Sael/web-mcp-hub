import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — WebMCP Hub",
};

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-14">
      <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
      <p className="text-zinc-500 text-sm mb-10">Last updated: February 2025</p>

      <div className="space-y-8 text-zinc-300 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-white mb-3">Overview</h2>
          <p>
            WebMCP Hub is an open community registry of WebMCP configurations for AI agents. This
            policy covers both the WebMCP Hub website (<strong>webmcp-hub.com</strong>) and the{" "}
            <strong>WebMCP Hub Chrome extension</strong>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">What the Chrome extension does</h2>
          <p className="mb-3">
            The extension registers WebMCP tool definitions on web pages so that AI agents can
            interact with websites through structured tools instead of screen scraping.
          </p>
          <p>
            It works by looking up the current page&apos;s domain against the WebMCP Hub registry.
            If a matching configuration exists, the extension registers the defined tools on the
            page. If no configuration matches, the extension does nothing.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">Data collected by the extension</h2>
          <p className="mb-3">
            When you navigate to a web page, the extension sends the following to the WebMCP Hub API
            to check for matching configurations:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Domain name</strong> of the page you are visiting (e.g.{" "}
              <code className="text-zinc-400">google.com</code>)
            </li>
            <li>
              <strong>URL path</strong> of the page (e.g.{" "}
              <code className="text-zinc-400">/dashboard/settings</code>)
            </li>
          </ul>
          <p className="mt-3">
            The extension does <strong>not</strong> collect or transmit:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Page content, form data, or any data you enter on websites</li>
            <li>Cookies, authentication tokens, or session data</li>
            <li>Browsing history beyond the current navigation lookup</li>
            <li>Personal information such as your name, email, or IP address</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">How data is used</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Config lookup:</strong> Domain and path are used solely to find matching
              WebMCP configurations. The lookup is stateless — the API does not log or store
              individual requests.
            </li>
            <li>
              <strong>Session cache:</strong> Matched configurations are stored temporarily in the
              browser&apos;s session storage (per tab) and are automatically removed when the tab is
              closed.
            </li>
            <li>
              <strong>Hub URL setting:</strong> Your configured hub URL is stored in Chrome sync
              storage so it persists across devices. No other settings are stored.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">Data collected by the website</h2>
          <p className="mb-3">
            The WebMCP Hub website collects only what is necessary to operate the registry:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>GitHub account info</strong> (username, profile image) if you sign in to
              contribute configurations
            </li>
            <li>
              <strong>Configurations you submit</strong> (domain, tools, metadata) which are
              publicly visible in the registry
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">Third-party services</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Vercel</strong> — Hosts the website and API
            </li>
            <li>
              <strong>Supabase</strong> — Database for the configuration registry
            </li>
            <li>
              <strong>GitHub OAuth</strong> — Authentication for contributors
            </li>
          </ul>
          <p className="mt-3">We do not use analytics, tracking pixels, or advertising services.</p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">Data retention</h2>
          <p>
            Configuration data in the registry is retained as long as the registry operates.
            Contributors can request removal of their submitted configurations at any time. The
            extension does not persist any browsing data — all lookup data is session-scoped and
            cleared when the tab closes.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">Your choices</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              You can <strong>uninstall the extension</strong> at any time to stop all lookups
            </li>
            <li>
              You can <strong>change the hub URL</strong> via the extension popup settings if you
              want to use an alternative registry
            </li>
            <li>
              You can <strong>delete your account</strong> and contributed configurations by
              contacting us
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">Changes to this policy</h2>
          <p>
            We may update this policy as the project evolves. Significant changes will be noted in
            the extension&apos;s changelog. Continued use of the extension or website after changes
            constitutes acceptance of the updated policy.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-white mb-3">Contact</h2>
          <p className="mb-3">
            If you have questions about this policy or want to request data removal, reach out via
            email:{" "}
            <a
              href="mailto:joakim.selemyr16@gmail.com"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              email
            </a>
          </p>
          <p className="text-zinc-400 text-sm">
            A public GitHub repository is coming soon — once open-sourced you will also be able to
            open issues there.
          </p>
        </section>
      </div>
    </div>
  );
}
