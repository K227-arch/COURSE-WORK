/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum DocDirection {
  INCOMING = "incoming",
  OUTGOING = "outgoing",
}

export enum DocType {
  LETTER = "letter",
  FILE = "file",
  REPORT = "report",
}

export enum Priority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  IMMEDIATE = "immediate",
}

export enum SecurityClassification {
  OPEN = "open",
  RESTRICTED = "restricted",
  CONFIDENTIAL = "confidential",
  SECRET = "secret",
}

export enum DocStatus {
  REGISTERED = "registered",
  ASSIGNED = "assigned",
  IN_PROGRESS = "in-progress",
  DISPATCHED = "dispatched",
  CLOSED = "closed",
}

export interface RegistryDocument {
  id: string;
  refNo: string;
  title: string;
  direction: DocDirection;
  docType: DocType;
  senderName: string;
  recipientName: string;
  subject: string;
  summary?: string;
  bodyText?: string;
  receivedDate: string;
  priority: Priority;
  securityClassification: SecurityClassification;
  currentLocation: string; // Desk or Department
  currentHandler: string;   // Officer name
  status: DocStatus;
  fileName?: string;
  fileSize?: string;
  fileDataUrl?: string;     // Base64 file link or simulated attachment
  tags: string[];
  createdBy: string;
  createdTime: string;
}

export interface FileMovement {
  id: string;
  documentId: string;
  refNo: string;
  title: string;
  fromLocation: string;
  fromOfficer: string;
  toLocation: string;
  toOfficer: string;
  dispatchTime: string;
  receiveTime?: string;
  transitStatus: "dispatched" | "received" | "overdue";
  purpose: string;
  remarks?: string;
  receiverSignature?: string; // Electronic signature/confirmation
}

export interface FileRequisition {
  id: string;
  documentId: string;
  docRefNo: string;
  docTitle: string;
  requestorName: string;
  requestorEmail: string;
  department: string;
  requestDate: string;
  purpose: string;
  neededUntil: string;
  status: "pending" | "approved" | "issued" | "returned" | "rejected";
  approvedBy?: string;
  issuedTime?: string;
  returnedTime?: string;
  actionRemarks?: string;
  isPhysical: boolean; // Requisitions for physical folders or electronic
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  userId: string;
  userName: string;
  userEmail: string;
  details: string;
  severity: "info" | "warning" | "alert";
  refId?: string; // Reference ID of doc/movement
}

export interface AnalyticsSummary {
  totalIncoming: number;
  totalOutgoing: number;
  totalLetters: number;
  totalFiles: number;
  totalReports: number;
  pendingMovements: number;
  overdueMovements: number;
  requisitionsCount: {
    pending: number;
    approved: number;
    issued: number;
    returned: number;
  };
  bySecurity: {
    open: number;
    restricted: number;
    confidential: number;
    secret: number;
  };
}
