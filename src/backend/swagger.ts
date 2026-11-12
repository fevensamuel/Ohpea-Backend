/**
 * Comprehensive OpenAPI 3.0.3 Specification for OHPEA System
 * Covers every endpoint across Public, Auth, Admin Members, Payments, Dashboard, Content, SMS, Users, and Audit.
 */

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'OHPEA REST API Backend',
    version: '1.0.0',
    description:
      'Headless REST API backend for the Oromia Hospitality & Tourism Professionals Association (OHPEA). Powers the public registration & information website and the administrative member-management portal.',
    contact: {
      name: 'OHPEA Technical Administration',
      email: 'support@ohpea.org',
    },
  },
  servers: [
    {
      url: '/api',
      description: 'Default relative API server',
    },
    {
      url: 'http://localhost:3000/api',
      description: 'Local development server',
    },
  ],
  tags: [
    { name: 'Health', description: 'API health checks and engine status' },
    { name: 'Auth', description: 'Admin authentication, token verification, and password management' },
    { name: 'Public', description: 'Unauthenticated public association endpoints (lookups, programs, stats)' },
    { name: 'Public Registration', description: 'Public member onboarding and document submission' },
    { name: 'Members', description: 'Admin member management, verification, approvals, and exports' },
    { name: 'Dashboard', description: 'Real-time statistical aggregations, demographics, and metrics' },
    { name: 'Payments', description: 'Contribution tracking, official receipts, and financial reporting' },
    { name: 'Content', description: 'CMS announcements, activities, objectives, programs, and settings' },
    { name: 'SMS', description: 'AfroMessage SMS dispatches and targeted bulk campaigns' },
    { name: 'Users', description: 'Administrative user accounts and RBAC permission assignments' },
    { name: 'Audit', description: 'Immutable system action logs' },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Provide your JWT bearer token obtained from POST /api/auth/login',
      },
    },
    schemas: {
      ApiResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'object' },
          error: { type: 'string', example: null },
        },
      },
      ApiErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: { type: 'string', example: 'Validation failed or resource not found' },
          fields: { type: 'object', additionalProperties: { type: 'string' } },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['usernameOrEmail', 'password'],
        properties: {
          usernameOrEmail: { type: 'string', example: 'admin@ohpea.org' },
          password: { type: 'string', example: 'Admin12345!ChangeMe' },
        },
      },
      LoginResponseData: {
        type: 'object',
        properties: {
          token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsIn...' },
          user: {
            type: 'object',
            properties: {
              id: { type: 'string', example: '9a21b4fe-...' },
              username: { type: 'string', example: 'superadmin' },
              email: { type: 'string', example: 'admin@ohpea.org' },
              fullName: { type: 'string', example: 'OHPEA Central Administrator' },
              role: { type: 'string', enum: ['SuperAdmin', 'RegionalAdmin', 'Finance', 'Editor'], example: 'SuperAdmin' },
              permissions: { type: 'array', items: { type: 'string' } },
              regionId: { type: 'string', nullable: true },
              mustChangePassword: { type: 'boolean', example: false },
            },
          },
        },
      },
      MemberRegistrationRequest: {
        type: 'object',
        required: [
          'fullName',
          'phone',
          'email',
          'gender',
          'graduationLevelId',
          'occupationType',
          'sectorId',
          'fieldOfStudyId',
          'regionId',
          'idType',
          'idNumber',
          'consent',
        ],
        properties: {
          fullName: { type: 'string', example: 'Tolasa Gudeta' },
          phone: { type: 'string', example: '+251911223344' },
          email: { type: 'string', example: 'tolasa.gudeta@example.com' },
          gender: { type: 'string', enum: ['male', 'female'], example: 'male' },
          dateOfBirth: { type: 'string', format: 'date', example: '1995-04-12' },
          graduationLevelId: { type: 'string', example: 'grad-first_degree' },
          occupationType: { type: 'string', enum: ['private', 'government', 'other'], example: 'private' },
          sectorId: { type: 'string', example: 'sec-hotel' },
          fieldOfStudyId: { type: 'string', example: 'fos-tourism_mgmt' },
          professionalCategory: { type: 'string', example: 'Executive Housekeeper' },
          organizationName: { type: 'string', example: 'Oromia Grand Palace Hotel' },
          jobTitle: { type: 'string', example: 'General Manager' },
          regionId: { type: 'string', example: 'reg-adama-city' },
          town: { type: 'string', example: 'Adama' },
          idType: { type: 'string', enum: ['fayda', 'passport'], example: 'fayda' },
          idNumber: { type: 'string', example: '123456789012' },
          consent: { type: 'boolean', example: true },
        },
      },
      PaymentRecordRequest: {
        type: 'object',
        required: ['memberId', 'amountEtb', 'period', 'paidForDate', 'method'],
        properties: {
          memberId: { type: 'string', format: 'uuid', example: '320e6f77-...' },
          planId: { type: 'string', nullable: true, example: 'plan-monthly-100' },
          amountEtb: { type: 'number', example: 100 },
          period: { type: 'string', enum: ['weekly', 'monthly', 'yearly'], example: 'monthly' },
          paidForDate: { type: 'string', format: 'date', example: '2026-11-01' },
          method: { type: 'string', enum: ['cash', 'bank_transfer', 'mobile_money', 'other'], example: 'mobile_money' },
          bank: { type: 'string', example: 'Sinke Bank' },
          reference: { type: 'string', example: 'TXN-9988221' },
          note: { type: 'string', example: 'November monthly dues' },
        },
      },
      SmsCampaignRequest: {
        type: 'object',
        required: ['name', 'message'],
        properties: {
          name: { type: 'string', example: 'Annual General Meeting Invitation' },
          message: { type: 'string', example: 'Dear {{fullName}}, your OHPEA member number is {{memberNo}}. Please attend the upcoming summit.' },
          audienceFilter: {
            type: 'object',
            properties: {
              regionId: { type: 'string' },
              sectorId: { type: 'string' },
              membershipStatus: { type: 'string', enum: ['active', 'pending', 'inactive'] },
            },
          },
          scheduledAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Service health check and database connectivity',
        responses: {
          '200': { description: 'Service is healthy' },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Administrator login',
        description: 'Authenticates with username or email and returns a signed JWT token.',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } },
          },
        },
        responses: {
          '200': {
            description: 'Authentication successful',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginResponseData' } } },
          },
          '401': { description: 'Invalid credentials' },
          '429': { description: 'Too many login attempts' },
        },
      },
    },
    '/admin/login': {
      post: {
        tags: ['Auth'],
        summary: 'Alias for /auth/login',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } },
          },
        },
        responses: {
          '200': { description: 'Authentication successful' },
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get current administrator context',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'Current admin record' },
          '401': { description: 'Unauthorized' },
        },
      },
    },
    '/auth/change-password': {
      post: {
        tags: ['Auth'],
        summary: 'Change administrator password',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['currentPassword', 'newPassword'],
                properties: {
                  currentPassword: { type: 'string' },
                  newPassword: { type: 'string', minLength: 8 },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Password changed successfully' },
          '400': { description: 'Current password incorrect or validation error' },
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Audit-logged administrator logout',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'Logged out successfully' },
        },
      },
    },
    '/public/site-settings': {
      get: {
        tags: ['Public'],
        summary: 'Public organization settings, profile, and contacts',
        security: [],
        responses: {
          '200': { description: 'Site settings object' },
        },
      },
    },
    '/public/stats': {
      get: {
        tags: ['Public'],
        summary: 'Public safe aggregated metrics (4 numbers: totalMembers, accreditedHotels, certifiedGuides, trainingGraduates)',
        security: [],
        responses: {
          '200': { description: 'Safe aggregates object' },
        },
      },
    },
    '/public/lookups': {
      get: {
        tags: ['Public'],
        summary: 'Localized system lookups (regions, sectors, fields, grad levels)',
        security: [],
        parameters: [
          { name: 'lang', in: 'query', schema: { type: 'string', enum: ['en', 'om', 'am', 'ar', 'fr'] } },
        ],
        responses: {
          '200': { description: 'Localized lookup items' },
        },
      },
    },
    '/public/lookups/regions': {
      get: {
        tags: ['Public'],
        summary: 'Regions with nested woredas',
        security: [],
        responses: {
          '200': { description: 'List of regions with woredas' },
        },
      },
    },
    '/public/programs': {
      get: {
        tags: ['Public'],
        summary: 'List published core programs',
        security: [],
        responses: {
          '200': { description: 'List of program objects' },
        },
      },
    },
    '/public/programs/{slug}': {
      get: {
        tags: ['Public'],
        summary: 'Get program detail by slug',
        security: [],
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Program detail' },
          '404': { description: 'Program not found' },
        },
      },
    },
    '/public/objectives': {
      get: {
        tags: ['Public'],
        summary: 'List organizational objectives',
        security: [],
        parameters: [
          { name: 'kind', in: 'query', schema: { type: 'string', enum: ['general', 'official', 'main', 'specific'] } },
        ],
        responses: {
          '200': { description: 'List of objectives' },
        },
      },
    },
    '/public/partners': {
      get: {
        tags: ['Public'],
        summary: 'List published partner organizations',
        security: [],
        responses: {
          '200': { description: 'List of partners' },
        },
      },
    },
    '/public/activities': {
      get: {
        tags: ['Public'],
        summary: 'List recent organizational activities',
        security: [],
        parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } }],
        responses: {
          '200': { description: 'List of activities' },
        },
      },
    },
    '/public/announcements': {
      get: {
        tags: ['Public'],
        summary: 'List published announcements, events, and vacancies',
        security: [],
        parameters: [
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['vacancy', 'call_for_proposal', 'call_for_research', 'news', 'event'] } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        ],
        responses: {
          '200': { description: 'Paginated announcements' },
        },
      },
    },
    '/public/announcements/{slug}': {
      get: {
        tags: ['Public'],
        summary: 'Get published announcement by slug',
        security: [],
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Announcement detail' },
          '404': { description: 'Not found' },
        },
      },
    },
    '/public/registrations': {
      post: {
        tags: ['Public'],
        summary: 'Submit new membership registration (multipart/form-data)',
        security: [],
        description: 'Creates a pending member directly in the members table and associates uploaded documents with that member. OTP verification does not change member status.',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['fullName', 'phone', 'idType', 'idNumber', 'idDocument'],
                properties: {
                  fullName: { type: 'string', minLength: 2, maxLength: 120 },
                  email: { type: 'string', format: 'email' },
                  phone: { type: 'string', pattern: '^\\+251(9|7)\\d{8}$' },
                  gender: { type: 'string', enum: ['male', 'female', 'unspecified'] },
                  membershipCategory: {
                    type: 'string',
                    enum: ['Professional', 'Entrepreneur', 'Corporate', 'Associate'],
                  },
                  dateOfBirth: { type: 'string', format: 'date' },
                  nationality: { type: 'string' },
                  emergencyContactName: { type: 'string' },
                  emergencyContactPhone: { type: 'string' },
                  businessTin: { type: 'string' },
                  skills: { type: 'string' },
                  expertiseAreas: { type: 'array', items: { type: 'string' } },
                  interests: { type: 'array', items: { type: 'string' } },
                  qualification: { type: 'string' },
                  fieldOfStudy: { type: 'string' },
                  organization: { type: 'string' },
                  zone: { type: 'string' },
                  idType: { type: 'string', enum: ['fayda', 'passport', 'kebele', 'driver'] },
                  idNumber: { type: 'string' },
                  idDocument: { type: 'string', format: 'binary' },
                  credentialDocs: { type: 'array', items: { type: 'string', format: 'binary' } },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Pending member created; response contains memberId and memberNo' },
          '400': { description: 'Validation failed' },
          '409': { description: 'Member with the supplied phone, email, or ID already exists' },
        },
      },
    },
    '/public/registrations/otp/send': {
      post: {
        tags: ['Public'],
        summary: 'Dispatch 6-digit registration OTP to Ethiopian phone via AfroMessage',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['phone'],
                properties: {
                  phone: { type: 'string', pattern: '^\\+251(9|7)\\d{8}$' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'OTP sent' },
          '400': { description: 'Invalid phone or rate limit exceeded' },
        },
      },
    },
    '/public/registrations/otp/verify': {
      post: {
        tags: ['Public'],
        summary: 'Verify registration OTP code',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['phone', 'code'],
                properties: {
                  phone: { type: 'string' },
                  code: { type: 'string', minLength: 6, maxLength: 6 },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Verified successfully' },
          '400': { description: 'Invalid or expired code' },
        },
      },
    },
    '/public/contact': {
      post: {
        tags: ['Public'],
        summary: 'Submit contact message',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['fullName', 'email', 'phone', 'subject', 'message'],
                properties: {
                  fullName: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  phone: { type: 'string' },
                  subject: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Message received' },
        },
      },
    },
    '/public/newsletter': {
      post: {
        tags: ['Public'],
        summary: 'Subscribe to newsletter',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  name: { type: 'string' },
                  language: { type: 'string', enum: ['en', 'om', 'am'] },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Subscribed' },
        },
      },
    },
    '/public/translations/{lang}': {
      get: {
        tags: ['Public'],
        summary: 'Get UI translation strings for a language',
        parameters: [{ name: 'lang', in: 'path', required: true, schema: { type: 'string', enum: ['en', 'om', 'am', 'ar', 'fr'] } }],
        responses: {
          '200': { description: 'Key-value translations dictionary' },
        },
      },
    },
    '/admin/members': {
      get: {
        tags: ['Members'],
        summary: 'List members with filtering, search, and pagination',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string' } },
          { name: 'registrationStatus', in: 'query', schema: { type: 'string', enum: ['pending', 'approved', 'rejected'] } },
          { name: 'membershipStatus', in: 'query', schema: { type: 'string', enum: ['pending', 'active', 'inactive'] } },
          { name: 'gender', in: 'query', schema: { type: 'string', enum: ['male', 'female'] } },
          { name: 'regionId', in: 'query', schema: { type: 'string' } },
          { name: 'sectorId', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'sort', in: 'query', schema: { type: 'string', example: 'createdAt:desc' } },
        ],
        responses: {
          '200': { description: 'Paginated members list with metadata' },
          '401': { description: 'Unauthorized' },
        },
      },
      post: {
        tags: ['Members'],
        summary: 'Manually register a member by admin',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/MemberRegistrationRequest' } } },
        },
        responses: {
          '201': { description: 'Member created' },
        },
      },
    },
    '/admin/members/{id}': {
      get: {
        tags: ['Members'],
        summary: 'Get member profile with documents and payment history',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Full member record' },
          '404': { description: 'Member not found' },
        },
      },
      put: {
        tags: ['Members'],
        summary: 'Update member profile details',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: {
          '200': { description: 'Member updated' },
        },
      },
      delete: {
        tags: ['Members'],
        summary: 'Deactivate / soft-delete member (SuperAdmin only)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Member deactivated' },
        },
      },
    },
    '/admin/members/{id}/approve': {
      post: {
        tags: ['Members'],
        summary: 'Approve pending member registration',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Member approved' },
        },
      },
    },
    '/admin/members/{id}/reject': {
      post: {
        tags: ['Members'],
        summary: 'Reject pending member registration with reason',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['reason'],
                properties: { reason: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Member rejected' },
        },
      },
    },
    '/admin/members/{id}/status': {
      patch: {
        tags: ['Members'],
        summary: 'Toggle membership status (active | inactive)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['membershipStatus'],
                properties: { membershipStatus: { type: 'string', enum: ['active', 'inactive', 'pending'] } },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Status updated' },
        },
      },
    },
    '/admin/members/export': {
      get: {
        tags: ['Members'],
        summary: 'Export filtered members to Excel or PDF',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'format', in: 'query', schema: { type: 'string', enum: ['xlsx', 'pdf'], default: 'xlsx' } },
        ],
        responses: {
          '200': { description: 'Binary file download' },
        },
      },
    },
    '/admin/members/{id}/documents/{docId}': {
      get: {
        tags: ['Members'],
        summary: 'Securely stream private Fayda ID or credential document',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'docId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Binary stream with Content-Type header' },
          '404': { description: 'Document not found' },
        },
      },
    },
    '/admin/registrations/pending-count': {
      get: {
        tags: ['Members'],
        summary: 'Get total unreviewed registrations count for badge notification',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'Pending count' },
        },
      },
    },
    '/admin/dashboard/summary': {
      get: {
        tags: ['Dashboard'],
        summary: 'Get admin overview KPI counts',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'KPI summary statistics' },
        },
      },
    },
    '/admin/dashboard/members-by': {
      get: {
        tags: ['Dashboard'],
        summary: 'Get member demographic breakdown by dimension',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'dimension', in: 'query', required: true, schema: { type: 'string', enum: ['gender', 'sector', 'field', 'occupation', 'region', 'graduationLevel'] } },
          { name: 'lang', in: 'query', schema: { type: 'string', enum: ['en', 'om', 'am', 'ar', 'fr'] } },
        ],
        responses: {
          '200': { description: 'Array of [{ key, label, count, percent }]' },
        },
      },
    },
    '/admin/dashboard/contributions': {
      get: {
        tags: ['Dashboard'],
        summary: 'Get dynamic contribution time-series and financial analytics',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'range', in: 'query', schema: { type: 'string', enum: ['3m', '6m', '12m'], default: '12m' } },
          { name: 'group', in: 'query', schema: { type: 'string', enum: ['week', 'month', 'year'], default: 'month' } },
        ],
        responses: {
          '200': { description: 'Financial analytics time series' },
        },
      },
    },
    '/admin/payments': {
      get: {
        tags: ['Payments'],
        summary: 'List contribution payments with pagination',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'Payments list' },
        },
      },
      post: {
        tags: ['Payments'],
        summary: 'Record new contribution payment and generate official receipt',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/PaymentRecordRequest' } } },
        },
        responses: {
          '201': { description: 'Payment recorded' },
          '409': { description: 'Duplicate payment for period' },
        },
      },
    },
    '/admin/payments/{id}': {
      get: {
        tags: ['Payments'],
        summary: 'Get single payment detail',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Payment record' },
        },
      },
    },
    '/admin/payments/{id}/void': {
      post: {
        tags: ['Payments'],
        summary: 'Void an erroneous payment',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { note: { type: 'string' } } } } } },
        responses: {
          '200': { description: 'Payment voided' },
        },
      },
    },
    '/admin/payments/{id}/receipt': {
      get: {
        tags: ['Payments'],
        summary: 'Download or view official branded PDF payment receipt',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'PDF receipt binary' },
        },
      },
    },
    '/admin/payments/unpaid': {
      get: {
        tags: ['Payments'],
        summary: 'Identify active members with unpaid dues for a specific period',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'period', in: 'query', schema: { type: 'string', enum: ['monthly', 'yearly'], default: 'monthly' } },
          { name: 'date', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: {
          '200': { description: 'List of unpaid members' },
        },
      },
    },
    '/admin/contribution-plans': {
      get: {
        tags: ['Payments'],
        summary: 'List available contribution plans',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'Plans list' },
        },
      },
    },
    '/admin/payments/export': {
      get: {
        tags: ['Payments'],
        summary: 'Export payment records to Excel spreadsheet',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'XLSX file download' },
        },
      },
    },
    '/admin/announcements': {
      get: {
        tags: ['Content'],
        summary: 'List all announcements for admin management',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'Announcements list' },
        },
      },
      post: {
        tags: ['Content'],
        summary: 'Create announcement, vacancy, or event',
        security: [{ BearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: {
          '201': { description: 'Announcement created' },
        },
      },
    },
    '/admin/announcements/{id}/publish': {
      patch: {
        tags: ['Content'],
        summary: 'Publish an announcement',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Published' },
        },
      },
    },
    '/admin/announcements/{id}/archive': {
      patch: {
        tags: ['Content'],
        summary: 'Archive an announcement',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Archived' },
        },
      },
    },
    '/admin/messages': {
      get: {
        tags: ['Content'],
        summary: 'List contact inbox submissions',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'Messages list' },
        },
      },
    },
    '/admin/messages/{id}': {
      patch: {
        tags: ['Content'],
        summary: 'Update contact message status (read, replied, archived)',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string' } } } } } },
        responses: {
          '200': { description: 'Status updated' },
        },
      },
    },
    '/admin/subscribers': {
      get: {
        tags: ['Content'],
        summary: 'List newsletter subscribers',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'Subscribers list' },
        },
      },
    },
    '/admin/sms/send': {
      post: {
        tags: ['SMS'],
        summary: 'Send single SMS to member or phone number',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['message'],
                properties: {
                  memberId: { type: 'string' },
                  phone: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'SMS dispatched' },
        },
      },
    },
    '/admin/sms/campaigns': {
      get: {
        tags: ['SMS'],
        summary: 'List bulk SMS campaigns and delivery stats',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'Campaigns list' },
        },
      },
      post: {
        tags: ['SMS'],
        summary: 'Create and dispatch targeted bulk SMS campaign',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SmsCampaignRequest' } } },
        },
        responses: {
          '201': { description: 'Campaign created and queued' },
        },
      },
    },
    '/admin/sms/balance': {
      get: {
        tags: ['SMS'],
        summary: 'Get AfroMessage balance',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'Balance details' },
        },
      },
    },
    '/admin/meta/permissions': {
      get: {
        tags: ['Users'],
        summary: 'Single source of truth for permission keys and human labels',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'List of permission items' },
        },
      },
    },
    '/admin/users': {
      get: {
        tags: ['Users'],
        summary: 'List administrator accounts (SuperAdmin only)',
        security: [{ BearerAuth: [] }],
        responses: {
          '200': { description: 'Users list' },
        },
      },
      post: {
        tags: ['Users'],
        summary: 'Create new administrator with role and permissions',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'email', 'password', 'fullName', 'role'],
                properties: {
                  username: { type: 'string' },
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 8 },
                  fullName: { type: 'string' },
                  role: { type: 'string', enum: ['SuperAdmin', 'RegionalAdmin', 'Finance', 'Editor'] },
                  permissions: { type: 'array', items: { type: 'string' } },
                  regionId: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Admin created' },
        },
      },
    },
    '/admin/users/{id}/active': {
      patch: {
        tags: ['Users'],
        summary: 'Activate or deactivate administrator account',
        security: [{ BearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['isActive'], properties: { isActive: { type: 'boolean' } } } } } },
        responses: {
          '200': { description: 'Status updated' },
        },
      },
    },
    '/admin/audit-logs': {
      get: {
        tags: ['Audit'],
        summary: 'List audit log entries with pagination',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 25 } },
        ],
        responses: {
          '200': { description: 'Audit logs' },
        },
      },
    },
  },
};

export const swaggerSpec = openApiSpec;
