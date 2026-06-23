import type { Exam, Topic, ScheduledAssignment } from '../types/database';

function icalDate(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

function icalEscape(text: string): string {
  return text.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
}

export function exportToICal(
  exam: Exam,
  topics: Topic[],
  assignments: ScheduledAssignment[]
): void {
  const topicMap = new Map(topics.map((t) => [t.id, t]));
  const uid = (id: string) => `${id}@zenith-study`;

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ZENITH Study Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icalEscape(exam.name)} Study Plan`,
    'X-WR-TIMEZONE:UTC',
  ];

  // Add exam date as a VEVENT
  lines.push(
    'BEGIN:VEVENT',
    `UID:exam-${exam.id}@zenith-study`,
    `DTSTART;VALUE=DATE:${icalDate(exam.exam_date)}`,
    `DTEND;VALUE=DATE:${icalDate(exam.exam_date)}`,
    `SUMMARY:📝 ${icalEscape(exam.name)} — EXAM DAY`,
    `DESCRIPTION:Study plan created with ZENITH`,
    'END:VEVENT'
  );

  // Group assignments by date for summary events
  const byDate = new Map<string, ScheduledAssignment[]>();
  assignments.forEach((a) => {
    if (!byDate.has(a.assigned_date)) byDate.set(a.assigned_date, []);
    byDate.get(a.assigned_date)!.push(a);
  });

  byDate.forEach((dayAssignments, date) => {
    const topicTitles = dayAssignments
      .sort((a, b) => a.order_in_day - b.order_in_day)
      .map((a) => {
        const t = topicMap.get(a.topic_id);
        return t ? `• ${t.title}` : null;
      })
      .filter(Boolean);

    const phase = dayAssignments[0].phase;
    const emoji = phase === 'revision' ? '🔄' : '📖';
    const phaseLabel = phase === 'revision' ? 'Revision' : 'Learning';

    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid(date + '-' + phase)}`,
      `DTSTART;VALUE=DATE:${icalDate(date)}`,
      `DTEND;VALUE=DATE:${icalDate(date)}`,
      `SUMMARY:${emoji} ${icalEscape(exam.name)} — ${phaseLabel} (${dayAssignments.length} topics)`,
      `DESCRIPTION:${topicTitles.join('\\n')}`,
      'END:VEVENT'
    );
  });

  lines.push('END:VCALENDAR');

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${exam.name.replace(/[^a-z0-9]/gi, '_')}_study_plan.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
