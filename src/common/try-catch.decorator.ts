import { HttpException, HttpStatus } from '@nestjs/common';

export function TryCatch(
  errorMessage?: string,
  status: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
): MethodDecorator {
  return (_target, propertyKey, descriptor: PropertyDescriptor) => {
    const original = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      try {
        return await original.apply(this, args);
      } catch (err) {
        const className = this.constructor.name;
        console.error(
          `@@@@@ Error in ${className}####${String(propertyKey)}:`,
          err,
        );
        console.error('@@@@@ Error with arguments:', args);
        if (errorMessage) {
          throw new HttpException(errorMessage, status);
        }
        throw err;
      }
    };
    return descriptor;
  };
}
