import type { Metadata } from "next";
import { site } from "@/config/site";
import { SimplePage } from "../SimplePage";

export const metadata: Metadata = { title: "Terms of use" };

export default function TermsPage() {
  return (
    <SimplePage eyebrow={site.company} title="Terms of use">
      <p>These terms apply when you use the free AI-Readiness Scorecard and this website. By using them you accept these terms.</p>

      <h2>What the Scorecard is</h2>
      <p>
        The Scorecard is a free self-assessment. Your score is calculated by fixed rules from your own answers. The written report
        is drafted by AI and is general guidance, not professional, legal, tax or financial advice.
      </p>

      <h2>No promises of results</h2>
      <p>
        We make no promise of income, revenue, profit or savings from using the Scorecard, its report or any AI tool it mentions.
        Decisions you take based on the report are your own.
      </p>

      <h2>AI-drafted content</h2>
      <p>
        AI-written sections are marked &ldquo;Drafted by AI&rdquo;. They can contain mistakes. Check them against what you know about
        your business before acting on them.
      </p>

      <h2>Fair use</h2>
      <ul>
        <li>Give answers about a business you own or manage, and contact details that are yours.</li>
        <li>Do not try to disrupt the service, get around its limits or access other people&rsquo;s reports.</li>
      </ul>
      <p>We may limit how often the Scorecard can be started from one device or network.</p>

      <h2>Your report</h2>
      <p>
        You may use, print and share your own report within your business. The Scorecard questions, scoring method and page designs
        remain the property of {site.company}.
      </p>

      <h2>Liability</h2>
      <p>
        The Scorecard is provided free and as it is. To the extent the law allows, {site.company} is not liable for any loss arising
        from its use.
      </p>

      <h2>Law and jurisdiction</h2>
      <p>These terms are governed by the laws of India. Courts at Ahmedabad, Gujarat have jurisdiction.</p>

      <h2>Contact</h2>
      <p>
        <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a> · {site.contactPhone}
      </p>
    </SimplePage>
  );
}
