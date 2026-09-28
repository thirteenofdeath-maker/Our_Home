"use client";

import { useState } from "react";

import {
  Field,
  Input,
  TwoColumnFieldGrid,
} from "@/components/ui/Field";
import { financeDateTimeParts } from "@/features/finance/domain/occurred-at";

export function FinanceOccurredAtField({
  defaultValue,
  dateLabel = "วันที่",
  timeLabel = "เวลา",
  idPrefix = "occurred",
}: {
  defaultValue?: string | Date | null;
  dateLabel?: string;
  timeLabel?: string;
  idPrefix?: string;
}) {
  const [value, setValue] = useState(() => financeDateTimeParts(defaultValue));
  const dateId = `${idPrefix}Date`;
  const timeId = `${idPrefix}Time`;

  return (
    <>
      <input
        type="hidden"
        name="occurredAt"
        value={`${value.date}T${value.time}`}
      />
      <TwoColumnFieldGrid>
        <Field label={dateLabel} htmlFor={dateId}>
          <Input
            id={dateId}
            type="date"
            value={value.date}
            onChange={(event) =>
              setValue((current) => ({
                ...current,
                date: event.target.value,
              }))
            }
            required
          />
        </Field>
        <Field label={timeLabel} htmlFor={timeId}>
          <Input
            id={timeId}
            type="time"
            value={value.time}
            onChange={(event) =>
              setValue((current) => ({
                ...current,
                time: event.target.value,
              }))
            }
            required
          />
        </Field>
      </TwoColumnFieldGrid>
    </>
  );
}
