import type { Metadata } from "next";
import { site } from "@/config/site";
import { SimplePage } from "../SimplePage";

export const metadata: Metadata = { title: "Privacy notice" };

export default function PrivacyPage() {
  return (
    <SimplePage eyebrow="Digital Personal Data Protection Act, 2023" title="Privacy notice">
      <p>
        This notice explains how {site.company} (&ldquo;Amalthea&rdquo;, &ldquo;we&rdquo;), {site.city}, handles the personal data you
        give us through the AI-Readiness Scorecard and the Amalthea audit platform. Amalthea is the Data Fiduciary for this data.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>Contact details: your name, WhatsApp number and email.</li>
        <li>Business profile: business name, industry, city, turnover band and team size.</li>
        <li>Your answers to the Scorecard statements and open questions, and any files you upload during an audit.</li>
        <li>A random identifier stored in a cookie on your device, and a one-way hash of your network address. We use these only to limit how often the Scorecard can be started.</li>
      </ul>

      <h2>Why we use it</h2>
      <ul>
        <li>To calculate your score. Scores are calculated by fixed rules.</li>
        <li>To write your personal report. Your answers are sent to Anthropic&rsquo;s Claude AI service, which drafts the explanation, gaps, use cases and first actions. Every AI-written section is marked &ldquo;Drafted by AI&rdquo;.</li>
        <li>To send your report to you on WhatsApp (through Meta&rsquo;s WhatsApp Business service) and by email.</li>
        <li>To contact you about your results, which you agree to when you tick the consent box.</li>
      </ul>

      <h2>Voice notes</h2>
      <p>
        If you record a voice note, your browser&rsquo;s own speech service converts it to text on your device&rsquo;s behalf. We do
        not receive or store the audio. We store only the text, which you can edit before you submit.
      </p>

      <h2>Who sees it</h2>
      <p>
        You, the team members you assign during an audit, and the Amalthea audit team. The service providers named above process it
        only to perform their service for us. We do not sell your data or share it for advertising.
      </p>

      <h2>Where it is stored</h2>
      <p>Encrypted cloud storage. Region: {site.storageRegion}.</p>

      <h2>How long we keep it</h2>
      <p>
        We keep your data only as long as it is needed for the purposes above, or until you withdraw consent or ask us to delete it,
        unless a law requires us to keep it longer.
      </p>

      <h2>Your rights</h2>
      <ul>
        <li>Ask for a summary of the personal data we hold about you and how we use it.</li>
        <li>Ask us to correct, complete or update it.</li>
        <li>Ask us to delete it, and withdraw your consent at any time. Withdrawing consent does not affect what was done before.</li>
        <li>Nominate another person to exercise these rights on your behalf.</li>
        <li>Raise a grievance with us, and, if it is not resolved, with the Data Protection Board of India.</li>
      </ul>

      <h2>Contact and grievances</h2>
      <p>
        Write to <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a> or call {site.contactPhone}. Please mention the
        business name and WhatsApp number you used so we can find your records.
      </p>
    </SimplePage>
  );
}
