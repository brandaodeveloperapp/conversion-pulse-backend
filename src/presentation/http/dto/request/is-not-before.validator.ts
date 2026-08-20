import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

/**
 * Rejects an inverted date range.
 *
 * Without it the query runs and returns an empty series, which a dashboard
 * renders as "no data in this period" — hiding the fact that the range itself
 * was backwards.
 */
export function IsNotBeforeConstraint(
  property: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isNotBefore',
      target: object.constructor,
      propertyName,
      constraints: [property],
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          const [relatedPropertyName] = args.constraints as [string];
          const related = (args.object as Record<string, unknown>)[
            relatedPropertyName
          ];
          if (typeof value !== 'string' || typeof related !== 'string') {
            return true;
          }
          return new Date(value) >= new Date(related);
        },
        defaultMessage(args: ValidationArguments): string {
          const [relatedPropertyName] = args.constraints as [string];
          return `${args.property} must not be earlier than ${relatedPropertyName}`;
        },
      },
    });
  };
}
