import type { Response } from 'express';

export function success<T>(res: Response, data: T, status: number = 200) {
  return res.status(status).json({
    success: true,
    data,
  });
}

export function paginated<T>(
  res: Response,
  data: T[],
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  },
  status: number = 200
) {
  return res.status(status).json({
    success: true,
    data,
    meta,
  });
}

export function fail(
  res: Response,
  error: string,
  statusCode: number = 400,
  fields?: Record<string, string>
) {
  const body: any = {
    success: false,
    error,
  };
  if (fields && Object.keys(fields).length > 0) {
    body.fields = fields;
  }
  return res.status(statusCode).json(body);
}
