import type { Analysis } from './schema.ts';
import type { AnalysisInput } from './provider.ts';

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** Offline stand-in for the model. Content is assembled strictly from the supplied structured input. */
export function mockAnalysis(i: AnalysisInput): Analysis {
  const dims = [...i.readiness.dimensions];
  const sorted = [...dims].sort((a, b) => a.score - b.score);
  const lowest = sorted.slice(0, 2);
  const highest = sorted[sorted.length - 1];
  const ctx = i.context;
  const industry = (ctx.industry as string) ?? 'the business';
  const size = ctx.teamSize ? `a team of ${ctx.teamSize}` : 'its current team';
  const fd = i.indicators.founderDependency;
  const opp = i.indicators.opportunity;

  const gapFor = (d: (typeof dims)[number]) => ({
    title: `${d.label} is a relative weakness`,
    evidence: `This dimension scored ${d.score} out of 100, the ${d === lowest[0] ? 'lowest' : 'second-lowest'} of the five. ${i.readiness.weakestAnswers.length ? `Lower-scoring answers included: ${i.readiness.weakestAnswers.slice(0, 2).map((w) => `“${w.question}”`).join('; ')}.` : ''}`.trim(),
    why_it_matters: 'AI depends on dependable inputs and clear ownership; where this dimension is weak, AI output tends to inherit the same inconsistency.',
  });

  const gaps = lowest.map(gapFor);
  if (fd.level === 'high' || fd.level === 'very_high') {
    gaps.push({
      title: 'Decisions and knowledge converge on the founder',
      evidence: fd.signals[0] ?? 'Several founder-dependency signals were reported.',
      why_it_matters: 'AI that supports decisions needs defined decision rights; where the founder is the rule, there is little for AI to follow.',
    });
  }
  if (i.readiness.weakestAnswers[0]) {
    gaps.push({
      title: 'Weakest individual area of evidence',
      evidence: `The answer to “${i.readiness.weakestAnswers[0].question}” scored ${i.readiness.weakestAnswers[0].score} out of 100.`,
      why_it_matters: 'A single low-scoring foundation can limit the reliability of everything built on top of it.',
    });
  }

  return {
    executive_assessment: `The diagnostic places this ${industry} business at ${i.readiness.overallScore} out of 100, in the “${i.readiness.band}” band. The strongest dimension is ${highest.label} (${highest.score}); the weakest are ${lowest.map((l) => `${l.label} (${l.score})`).join(' and ')}. Founder dependency reads as ${fd.level.replace('_', ' ')}.`,
    readiness_interpretation: `A score of ${i.readiness.overallScore} out of 100 indicates that ${i.readiness.band === 'Ready' || i.readiness.band === 'Advanced' ? 'most foundations are in place' : 'some foundations are in place while others are not yet consistent'} for a business operating with ${size}. The overall figure is weighted toward data, systems and process discipline, so gaps there carry the most weight. This reflects the answers given; it does not predict results from any specific initiative.`,
    dimension_insights: dims.map((d) => ({
      dimension: d.id as Analysis['dimension_insights'][number]['dimension'],
      insight: `${d.label} scored ${d.score} out of 100. ${d.score >= 70 ? 'The answers point to reasonably dependable foundations here.' : d.score >= 50 ? 'The answers suggest partial foundations with visible inconsistency.' : 'The answers indicate that this foundation is not yet dependable.'}`,
    })),
    key_readiness_gaps: gaps.slice(0, 5),
    founder_dependency_insight: fd.signals.length
      ? `Founder dependency reads as ${fd.level.replace('_', ' ')}. ${fd.signals.slice(0, 3).join(' ')} This suggests that decision speed and continuity currently rest on a small number of people.`
      : 'The answers did not surface strong founder-dependency signals, which suggests responsibilities are reasonably distributed.',
    ai_opportunity_areas: opp.areas.slice(0, 4).map((a) => ({
      area: a.area,
      rationale: `Signalled ${a.strength === 'strong' ? 'strongly' : a.strength === 'moderate' ? 'moderately' : 'lightly'} through: ${a.basis.slice(0, 2).join('; ')}.`,
      readiness_note: `Relevance here depends on the state of ${lowest[0].label.toLowerCase()}, which currently scores ${lowest[0].score} out of 100.`,
    })),
    business_context_observations: [
      `The respondent holds the role of ${lower(String(ctx.role ?? 'a senior leader'))} in a ${industry} business${ctx.turnoverRange ? ` with turnover of ${ctx.turnoverRange}` : ''}.`,
      `Stated intent to adopt AI within twelve months is “${i.indicators.aiAdoptionIntent.label.toLowerCase()}”, which is recorded separately from readiness.`,
      opp.priorityOutcomes.length ? `The outcomes ranked highest were ${opp.priorityOutcomes.map(lower).join(', ')}.` : 'No priority outcomes were ranked.',
    ],
    consultation_focus_areas: [
      `How ${lowest[0].label.toLowerCase()} currently operates in practice`,
      'Where decision authority sits today, and where it is expected to sit',
      opp.areas[0] ? `Why ${opp.areas[0].area.toLowerCase()} stands out as an opportunity area` : 'Which parts of the business carry the most repetitive effort',
    ],
  };
}
