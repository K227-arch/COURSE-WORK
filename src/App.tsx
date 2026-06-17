/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import {
  FileText,
  Inbox,
  Send,
  Calendar,
  AlertTriangle,
  Shield,
  CheckCircle,
  Clock,
  ArrowRight,
  Upload,
  Search,
  Filter,
  Plus,
  Sparkles,
  BookOpen,
  Fingerprint,
  Activity,
  Check,
  MapPin,
  Database,
  X,
  RefreshCw,
  FileCheck,
  FileClock,
  QrCode,
  FileX
} from "lucide-react";

import {
  DocDirection,
  DocType,
  Priority,
  SecurityClassification,
  DocStatus,
  RegistryDocument,
  FileMovement,
  FileRequisition,
  AuditLog,
  AnalyticsSummary
} from "./types";

import { sampleLetters, SampleLetter } from "./components/SampleLetters";

// --- CUSTOM SVG CHARTS ---
// A clean, beautiful custom SVG bar chart to avoid extra package imports
function SimpleBarChart({ data, labelKey, valueKey, colorClass = "fill-emerald-600" }: { data: any[]; labelKey: string; valueKey: string; colorClass?: string }) {
  const maxVal = Math.max(...data.map(d => d[valueKey] || 1), 1);
  return (
    <div className="space-y-3">
      {data.map((item, idx) => {
        const percentage = Math.round(((item[valueKey] || 0) / maxVal) * 100);
        return (
          <div key={idx} className="space-y-1">
            <div className="flex justify-between text-xs text-slate-600 font-medium">
              <span>{item[labelKey]}</span>
              <span>{item[valueKey]} file{item[valueKey] !== 1 ? 's' : ''}</span>
            </div>
            <div className="h-5 w-full bg-slate-100 rounded-md overflow-hidden flex items-center">
              <div 
                className={`h-full transition-all duration-500 rounded-r-md ${colorClass}`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<"overview" | "registry" | "intake" | "tracking" | "requisitions" | "audit">("overview");

  // State
  const [isUsingLocalStorageFallback, setIsUsingLocalStorageFallback] = useState(false);
  const [documents, setDocuments] = useState<RegistryDocument[]>([]);
  const [movements, setMovements] = useState<FileMovement[]>([]);
  const [requisitions, setRequisitions] = useState<FileRequisition[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSummary>({
    totalIncoming: 0,
    totalOutgoing: 0,
    totalLetters: 0,
    totalFiles: 0,
    totalReports: 0,
    pendingMovements: 0,
    overdueMovements: 0,
    requisitionsCount: { pending: 0, approved: 0, issued: 0, returned: 0 },
    bySecurity: { open: 0, restricted: 0, confidential: 0, secret: 0 }
  });

  // Loading States
  const [loading, setLoading] = useState(true);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDirection, setFilterDirection] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterSecurity, setFilterSecurity] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");

  // Selected Items for Drawer / Modal
  const [selectedDoc, setSelectedDoc] = useState<RegistryDocument | null>(null);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState<FileMovement | null>(null);
  const [showReqModal, setShowReqModal] = useState(false);

  // Form states for New Document Intake
  const [docTitle, setDocTitle] = useState("");
  const [docDirection, setDocDirection] = useState<DocDirection>(DocDirection.INCOMING);
  const [docType, setDocType] = useState<DocType>(DocType.LETTER);
  const [senderName, setSenderName] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [priority, setPriority] = useState<Priority>(Priority.MEDIUM);
  const [securityClassification, setSecurityClassification] = useState<SecurityClassification>(SecurityClassification.OPEN);
  const [currentLocation, setCurrentLocation] = useState("");
  const [currentHandler, setCurrentHandler] = useState("");
  const [refNo, setRefNo] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [attachedFile, setAttachedFile] = useState<{ name: string; size: string; dataUrl: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Form states for Direct Outward Dispatch / Handheld transfer
  const [transitToLocation, setTransitToLocation] = useState("");
  const [transitToOfficer, setTransitToOfficer] = useState("");
  const [transitPurpose, setTransitPurpose] = useState("");
  const [transitRemarks, setTransitRemarks] = useState("");

  // Signature state for manual receipt signing
  const [signType, setSignType] = useState<"draw" | "type">("type");
  const [typedSignature, setTypedSignature] = useState("S. N. Nakato");
  const [sigCanvasPoints, setSigCanvasPoints] = useState<{ x: number; y: number }[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Form states for Borrowing Requisition
  const [reqDocId, setReqDocId] = useState("");
  const [reqRequestor, setReqRequestor] = useState("");
  const [reqEmail, setReqEmail] = useState("");
  const [reqDept, setReqDept] = useState("");
  const [reqPurpose, setReqPurpose] = useState("");
  const [reqDuration, setReqDuration] = useState("");
  const [reqPhysical, setReqPhysical] = useState(true);

  // Quick info notification toast
  const [notification, setNotification] = useState<{ message: string; type: "success" | "warn" | "info" } | null>(null);

  const showToast = (message: string, type: "success" | "warn" | "info" = "success") => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(prev => prev?.message === message ? null : prev);
    }, 4500);
  };

  // -----------------------------------------------------------------
  // Sync routines with endpoints
  // -----------------------------------------------------------------
  const loadLocalStorageFallback = () => {
    setIsUsingLocalStorageFallback(true);

    const defaultDocs: RegistryDocument[] = [
      {
        id: "doc-01",
        refNo: "MPSD/ADM/2026/012",
        title: "Quarterly Performance Audit on Decentralized Registry Files",
        direction: DocDirection.INCOMING,
        docType: DocType.REPORT,
        senderName: "Office of the Auditor General (OAG)",
        recipientName: "Permanent Secretary, Ministry of Public Service",
        subject: "Audit of registry procedures, document misplacement rates, and digitisation compliance.",
        summary: "Formal audit highlighting a 14% file misplacement rate in manual ministries. Strongly recommends transition to barcoded ledger systems and secure central indexation to restrict direct physical workspace checkouts.",
        bodyText: "Subject: Audit report on registry procedures.\n\nFollowing physical assessment of three major district registries (Central, Northern, and East-Central), we detected significant record duplication and filing backlogs. File misplacement during administrative transit between desk stations constitutes 68% of information delays. Immediate automation of the routing grid is recommended.",
        receivedDate: "2026-06-15T09:30:00Z",
        priority: Priority.HIGH,
        securityClassification: SecurityClassification.RESTRICTED,
        currentLocation: "Registrar Central Archives",
        currentHandler: "Senior Registrar Nakato",
        status: DocStatus.REGISTERED,
        fileName: "OAG_Performance_Audit_2026_Q2.pdf",
        fileSize: "2.4 MB",
        fileDataUrl: "",
        tags: ["Audit", "ArchivalCompliance", "RegistryReform"],
        createdBy: "Senior Registrar Nakato",
        createdTime: "2026-06-15T09:45:00Z"
      },
      {
        id: "doc-02",
        refNo: "MOFP/BUD/2026/045",
        title: "Draft Budget Circular FY 2026/2027 Recurrent Expenditure Limits",
        direction: DocDirection.INCOMING,
        docType: DocType.LETTER,
        senderName: "Ministry of Finance, Planning and Economic Development",
        recipientName: "All Accounting Officers / Cabinet Secretaries",
        subject: "Expenditure ceilings for administrative and technology hardware procurement.",
        summary: "Official guidance limiting ICT hardware expenditure to central cloud migrations. Requires all ministries to trim physical storage room space budgets by 25% by migrating registries digital.",
        bodyText: "RE: BUDGET CEILINGS FOR THE NEXT FINANCIAL CYCLE\n\nTo ensure balanced allocation, recurrent expenditure under Item 221011 (Printing & Stationery) is down-scaled by 22% in line with federal digitisation targets. Financial votes must prioritise paperless registry pipelines. Digital transformation platforms must be deployed using containerized architectures.",
        receivedDate: "2026-06-16T11:15:00Z",
        priority: Priority.IMMEDIATE,
        securityClassification: SecurityClassification.CONFIDENTIAL,
        currentLocation: "Finance & Accounts Department",
        currentHandler: "Director Finance Birungi",
        status: DocStatus.IN_PROGRESS,
        fileName: "Budget_Expenditure_Ceilings_FY26.pdf",
        fileSize: "1.1 MB",
        fileDataUrl: "",
        tags: ["ExpenditureCeilings", "Finance", "PaperlessDirective"],
        createdBy: "Assistant Registrar Okello",
        createdTime: "2026-06-16T11:30:00Z"
      },
      {
        id: "doc-03",
        refNo: "MPSD/EST/2026/009",
        title: "Establishment Minute: Restructuring of National Archives Staffing",
        direction: DocDirection.OUTGOING,
        docType: DocType.FILE,
        senderName: "Permanent Secretary, Ministry of Public Service",
        recipientName: "Minister of Civil Service and Administration",
        subject: "Comprehensive re-allocation of manual registry personnel to digital data curators.",
        summary: "Personnel transition proposal mapping 400 manual paper dispatch clerks to centralized system administration and data validation officers.",
        bodyText: "MEMORANDUM FOR THE HONOURABLE MINISTER\n\nFollowing the digitization directives, we have formulated the Establishment Restructuring Plan (ERP-3). This plan handles the re-skilling of file-room clerks into Data Security Officers and Scanning Supervisors. Budget impact is neutral, utilizing existing payroll lines. Seeking approval to dispatch.",
        receivedDate: "2026-06-10T14:40:00Z",
        priority: Priority.MEDIUM,
        securityClassification: SecurityClassification.SECRET,
        currentLocation: "Office of the Permanent Secretary",
        currentHandler: "Secretary Arthur",
        status: DocStatus.CLOSED,
        fileName: "Est_Registry_Restructuring_Draft.docx",
        fileSize: "850 KB",
        fileDataUrl: "",
        tags: ["Establishment", "HumanResources", "SecurityClearance"],
        createdBy: "Senior Registrar Nakato",
        createdTime: "2026-06-10T14:55:00Z"
      }
    ];

    const defaultMovs: FileMovement[] = [
      {
        id: "mov-01",
        documentId: "doc-01",
        refNo: "MPSD/ADM/2026/012",
        title: "Quarterly Performance Audit on Decentralized Registry Files",
        fromLocation: "Registry Central Entrance Desk",
        fromOfficer: "Assistant Registrar Okello",
        toLocation: "Registrar Central Archives",
        toOfficer: "Senior Registrar Nakato",
        dispatchTime: "2026-06-15T09:45:00Z",
        receiveTime: "2026-06-15T10:12:00Z",
        transitStatus: "received",
        purpose: "Primary archival registration, sorting, and file tagging.",
        remarks: "File uploaded successfully and initial tag metadata written.",
        receiverSignature: "N. Nakato"
      },
      {
        id: "mov-02",
        documentId: "doc-02",
        refNo: "MOFP/BUD/2026/045",
        title: "Draft Budget Circular FY 2026/2027 Recurrent Expenditure Limits",
        fromLocation: "Registry Central Entrance Desk",
        fromOfficer: "Assistant Registrar Okello",
        toLocation: "Finance & Accounts Department",
        toOfficer: "Director Finance Birungi",
        dispatchTime: "2026-06-16T11:35:00Z",
        receiveTime: "2026-06-16T12:05:00Z",
        transitStatus: "received",
        purpose: "For direct review of recurrent expenditure margins.",
        remarks: "Flagged immediate. High-priority clearance requested.",
        receiverSignature: "B. Birungi"
      },
      {
        id: "mov-03",
        documentId: "doc-01",
        refNo: "MPSD/ADM/2026/012",
        title: "Quarterly Performance Audit on Decentralized Registry Files",
        fromLocation: "Registrar Central Archives",
        fromOfficer: "Senior Registrar Nakato",
        toLocation: "Office of the Permanent Secretary",
        toOfficer: "Secretary Arthur",
        dispatchTime: "2026-06-16T15:00:00Z",
        transitStatus: "received",
        receiveTime: "2026-06-16T16:00:00Z",
        receiverSignature: "Secretary Arthur",
        purpose: "For strategic signature and final ministerial comments.",
        remarks: "Physical file was dispatched via courier and electronic checkout resolved."
      }
    ];

    const defaultReqs: FileRequisition[] = [
      {
        id: "req-01",
        documentId: "doc-01",
        docRefNo: "MPSD/ADM/2026/012",
        docTitle: "Quarterly Performance Audit on Decentralized Registry Files",
        requestorName: "Principal HR Officer Musoke",
        requestorEmail: "musoke.hr@publicservice.go.ug",
        department: "Human Resource Division",
        requestDate: "2026-06-17T08:00:00Z",
        purpose: "Need to verify proposed restructuring margins described in section 4 of the audit report.",
        neededUntil: "2026-06-19",
        status: "pending",
        isPhysical: true
      },
      {
        id: "req-02",
        documentId: "doc-03",
        docRefNo: "MPSD/EST/2026/009",
        docTitle: "Establishment Minute: Restructuring of National Archives Staffing",
        requestorName: "Senior Registrar Nakato",
        requestorEmail: "nakato.registry@publicservice.go.ug",
        department: "Registrar Central Archives",
        requestDate: "2026-06-12T09:00:00Z",
        purpose: "Routine archival verification of post codes.",
        neededUntil: "2026-06-15",
        status: "returned",
        approvedBy: "Permanent Secretary Admin",
        issuedTime: "2026-06-12T10:00:00Z",
        returnedTime: "2026-06-14T16:30:00Z",
        actionRemarks: "Returned in perfect physical state.",
        isPhysical: false
      }
    ];

    const defaultLogs: AuditLog[] = [
      {
        id: "log-01",
        timestamp: "2026-06-15T09:45:00Z",
        action: "DOC_REGISTERED",
        userId: "nakato-001",
        userName: "Nakato Nakato",
        userEmail: "nakato.registry@publicservice.go.ug",
        details: "Registered incoming report document MPSD/ADM/2026/012 into archives database.",
        severity: "info",
        refId: "doc-01"
      },
      {
        id: "log-02",
        timestamp: "2026-06-15T10:12:00Z",
        action: "FILE_MOVEMENT_RECEIVED",
        userId: "nakato-001",
        userName: "Nakato Nakato",
        userEmail: "nakato.registry@publicservice.go.ug",
        details: "Acknowledged receipt of physical file registry voucher for report MPSD/ADM/2026/012.",
        severity: "info",
        refId: "mov-01"
      },
      {
        id: "log-03",
        timestamp: "2026-06-16T11:30:00Z",
        action: "DOC_REGISTERED",
        userId: "okello-503",
        userName: "Assistant Registrar Okello",
        userEmail: "okello.reg@publicservice.go.ug",
        details: "Registered incoming confidential finance budget ceiling letter MOFP/BUD/2026/045.",
        severity: "info",
        refId: "doc-02"
      },
      {
        id: "log-04",
        timestamp: "2026-06-16T15:00:00Z",
        action: "FILE_MOVEMENT_DISPATCHED",
        userId: "nakato-001",
        userName: "Nakato Nakato",
        userEmail: "nakato.registry@publicservice.go.ug",
        details: "Dispatched audit folder to Permanent Secretary Office. Marked transit with barcode registry.",
        severity: "info",
        refId: "mov-03"
      }
    ];

    let localDocs = localStorage.getItem("fed_documents");
    let localMovs = localStorage.getItem("fed_movements");
    let localReqs = localStorage.getItem("fed_requisitions");
    let localLogs = localStorage.getItem("fed_logs");

    let finalDocs = defaultDocs;
    let finalMovs = defaultMovs;
    let finalReqs = defaultReqs;
    let finalLogs = defaultLogs;

    if (localDocs) {
      try { finalDocs = JSON.parse(localDocs); } catch(e) {}
    } else {
      localStorage.setItem("fed_documents", JSON.stringify(finalDocs));
    }

    if (localMovs) {
      try { finalMovs = JSON.parse(localMovs); } catch(e) {}
    } else {
      localStorage.setItem("fed_movements", JSON.stringify(finalMovs));
    }

    if (localReqs) {
      try { finalReqs = JSON.parse(localReqs); } catch(e) {}
    } else {
      localStorage.setItem("fed_requisitions", JSON.stringify(finalReqs));
    }

    if (localLogs) {
      try { finalLogs = JSON.parse(localLogs); } catch(e) {}
    } else {
      localStorage.setItem("fed_logs", JSON.stringify(finalLogs));
    }

    // Compute metrics
    const totalIncoming = finalDocs.filter(d => d.direction === DocDirection.INCOMING).length;
    const totalOutgoing = finalDocs.filter(d => d.direction === DocDirection.OUTGOING).length;
    const totalLetters = finalDocs.filter(d => d.docType === DocType.LETTER).length;
    const totalFiles = finalDocs.filter(d => d.docType === DocType.FILE).length;
    const totalReports = finalDocs.filter(d => d.docType === DocType.REPORT).length;
    const pendingMovements = finalMovs.filter(m => !m.receiveTime).length;
    const overdueMovements = 0;

    const requisitionsCount = {
      pending: finalReqs.filter(r => r.status === "pending").length,
      approved: finalReqs.filter(r => r.status === "approved").length,
      issued: finalReqs.filter(r => r.status === "issued").length,
      returned: finalReqs.filter(r => r.status === "returned").length,
    };

    const bySecurity = {
      open: finalDocs.filter(d => d.securityClassification === SecurityClassification.OPEN).length,
      restricted: finalDocs.filter(d => d.securityClassification === SecurityClassification.RESTRICTED).length,
      confidential: finalDocs.filter(d => d.securityClassification === SecurityClassification.CONFIDENTIAL).length,
      secret: finalDocs.filter(d => d.securityClassification === SecurityClassification.SECRET).length,
    };

    setDocuments(finalDocs);
    setMovements(finalMovs);
    setRequisitions(finalReqs);
    setLogs(finalLogs);
    setAnalytics({
      totalIncoming,
      totalOutgoing,
      totalLetters,
      totalFiles,
      totalReports,
      pendingMovements,
      overdueMovements,
      requisitionsCount,
      bySecurity
    });
  };

  const loadAllData = async () => {
    try {
      setRefreshing(true);
      const [resDocs, resMovs, resReqs, resLogs, resAnal] = await Promise.all([
        fetch("/api/documents"),
        fetch("/api/movements"),
        fetch("/api/requisitions"),
        fetch("/api/logs"),
        fetch("/api/analytics")
      ]);

      if (resDocs.ok && resMovs.ok && resReqs.ok && resLogs.ok && resAnal.ok) {
        setDocuments(await resDocs.json());
        setMovements(await resMovs.json());
        setRequisitions(await resReqs.json());
        setLogs(await resLogs.json());
        setAnalytics(await resAnal.json());
        setIsUsingLocalStorageFallback(false);
      } else {
        loadLocalStorageFallback();
      }
    } catch (err) {
      console.warn("Switching to LocalStorage fallback mode:", err);
      loadLocalStorageFallback();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Handle signature canvas drawing
  useEffect(() => {
    if (showReceiveModal && signType === "draw" && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "#047857"; // Emerald-700
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        if (sigCanvasPoints.length > 0) {
          ctx.beginPath();
          ctx.moveTo(sigCanvasPoints[0].x, sigCanvasPoints[1]?.y || sigCanvasPoints[0].y);
          for (let i = 1; i < sigCanvasPoints.length; i++) {
            ctx.lineTo(sigCanvasPoints[i].x, sigCanvasPoints[i].y);
          }
          ctx.stroke();
        }
      }
    }
  }, [sigCanvasPoints, showReceiveModal, signType]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setIsDrawing(true);
    setSigCanvasPoints([{ x, y }]);
  };

  const drawSignature = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setSigCanvasPoints(prev => [...prev, { x, y }]);
  };

  const clearSignatureCanvas = () => {
    setSigCanvasPoints([]);
  };

  // Simulated drag and drop upload
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setAttachedFile({
        name: file.name,
        size: (file.size / (1024 * 1024)).toFixed(2) + " MB",
        dataUrl
      });
      // Pre-populate Title if currently blank
      if (!docTitle) {
        const cleanName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        setDocTitle(cleanName.replace(/_/g, " "));
      }
      showToast(`Temporary attachment "${file.name}" placed in OCR buffer pipeline.`);
    };

    // If it's a text/doc we can extract content to simulate AI analysis
    if (file.type.startsWith("text/")) {
      const textReader = new FileReader();
      textReader.onload = (e) => {
        const rawText = e.target?.result as string;
        setBodyText(rawText);
      };
      textReader.readAsText(file);
    } else {
      // Dummy text for binary files to ensure AI classifier works nicely
      setBodyText(`Official digitised scan file [${file.name}]. This includes confidential policy updates, budget ceilings, and archival restructuring frameworks which require immediate records placement.`);
    }
    reader.readAsDataURL(file);
  };

  // Load sample letter/report templates
  const loadSample = (sample: SampleLetter) => {
    setDocTitle(sample.title);
    setDocType(sample.docType as DocType);
    setBodyText(sample.text);
    setSubject(sample.title);
    // Determine reasonable sender based on structure
    setSenderName(sample.source);
    setRecipientName("All Accounting Officers, Ministry of Civil Service");
    // Generate simulated PDF attachment representation
    setAttachedFile({
      name: `${sample.title.toLowerCase().replace(/\s+/g, "_")}.pdf`,
      size: "1.45 MB",
      dataUrl: "data:application/pdf;base64,JVBERi0xLjQK..."
    });
    showToast(`Loaded "${sample.title}" onto index preparation desk! Click 'Analyze with AI Guide' next.`);
  };

  // AI-Powered analyze via Server API (calls Google Gemini)
  const triggerAIAnalyze = async () => {
    if (!bodyText && !docTitle) {
      showToast("Inadequate content. Please type inside text area, or upload a digital file first.", "warn");
      return;
    }
    setAiAnalyzing(true);

    if (isUsingLocalStorageFallback) {
      setTimeout(() => {
        const textToAnalyze = (docTitle + " " + bodyText).toLowerCase();
        let guessedClassification = SecurityClassification.OPEN;
        if (textToAnalyze.includes("confidential") || textToAnalyze.includes("budget") || textToAnalyze.includes("recurrent")) {
          guessedClassification = SecurityClassification.CONFIDENTIAL;
        } else if (textToAnalyze.includes("secret") || textToAnalyze.includes("personnel") || textToAnalyze.includes("restructuring")) {
          guessedClassification = SecurityClassification.SECRET;
        } else if (textToAnalyze.includes("audit") || textToAnalyze.includes("restriction")) {
          guessedClassification = SecurityClassification.RESTRICTED;
        }

        let guessedPriority = Priority.MEDIUM;
        if (textToAnalyze.includes("immediate") || textToAnalyze.includes("urgent") || textToAnalyze.includes("budget")) {
          guessedPriority = Priority.IMMEDIATE;
        } else if (textToAnalyze.includes("audit") || textToAnalyze.includes("high")) {
          guessedPriority = Priority.HIGH;
        }

        const tags = ["HeuristicIndex", "LocalFallback"];
        if (textToAnalyze.includes("audit")) tags.push("Audit");
        if (textToAnalyze.includes("budget") || textToAnalyze.includes("expenditure")) tags.push("Finance");
        if (textToAnalyze.includes("personnel") || textToAnalyze.includes("staffing")) tags.push("HR");

        setRefNo(`MPSD/LOCAL/${new Date().getFullYear()}/${Math.floor(Math.random() * 899 + 100)}`);
        setSubject(`Local analysis of "${docTitle}": summary of main themes.`);
        setSecurityClassification(guessedClassification);
        setPriority(guessedPriority);
        setTagsInput(tags.join(", "));
        setAiAnalyzing(false);
        showToast("Local intelligence engine parsed and classified the document!", "success");
      }, 750);
      return;
    }

    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bodyText,
          docType,
          title: docTitle
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setRefNo(data.refNo);
          setSubject(data.summary);
          setSecurityClassification(data.securityClassification as SecurityClassification);
          setPriority(data.priority as Priority);
          setTagsInput(data.tags?.join(", ") || "");
          
          if (data.isAIPowered) {
            showToast("Gemini 3.5 Archival expert successfully indexed the document!", "success");
          } else {
            showToast("Local heuristic index generated as a backup (AI Key unconfigured).", "info");
          }
        } else {
          showToast(`Classifier warning: ${data.error || 'Check server configuration.'}`, "warn");
        }
      } else {
        showToast("Unable to reach classification server pipeline.", "warn");
      }
    } catch (err) {
      console.error(err);
      showToast("Critical connection problem while querying Gemini neural engine.", "warn");
    } finally {
      setAiAnalyzing(false);
    }
  };

  // Submit new document to registry
  const handleIntakeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle || !refNo) {
      showToast("Document Title and official Ref Number are mandatory parameters.", "warn");
      return;
    }

    try {
      const payload = {
        refNo,
        title: docTitle,
        direction: docDirection,
        docType,
        senderName: senderName || "General Intake Post",
        recipientName: recipientName || "Central Registry",
        subject: subject || docTitle,
        summary: subject,
        bodyText,
        priority,
        securityClassification,
        currentLocation: currentLocation || "Registrar Central Archives",
        currentHandler: currentHandler || "Senior Registrar Nakato",
        status: DocStatus.REGISTERED,
        fileName: attachedFile?.name,
        fileSize: attachedFile?.size,
        fileDataUrl: attachedFile?.dataUrl,
        tags: tagsInput ? tagsInput.split(",").map(t => t.trim()).filter(t => t.length > 0) : []
      };

      if (isUsingLocalStorageFallback) {
        const newDoc: RegistryDocument = {
          ...payload,
          id: `doc-${Date.now()}`,
          receivedDate: new Date().toISOString(),
          createdBy: "Senior Registrar Nakato",
          createdTime: new Date().toISOString()
        };
        const updatedDocs = [newDoc, ...documents];
        localStorage.setItem("fed_documents", JSON.stringify(updatedDocs));

        const newLogObj: AuditLog = {
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          action: "DOC_REGISTERED",
          userId: "nakato-001",
          userName: "Nakato Nakato",
          userEmail: "nakato.registry@publicservice.go.ug",
          details: `Registered incoming document ${newDoc.refNo} ("${newDoc.title}") into local browser index.`,
          severity: "info",
          refId: newDoc.id
        };
        const updatedLogs = [newLogObj, ...logs];
        localStorage.setItem("fed_logs", JSON.stringify(updatedLogs));

        setDocuments(updatedDocs);
        setLogs(updatedLogs);

        showToast("New document securely logged into federal digital repository!");
        setDocTitle("");
        setRefNo("");
        setBodyText("");
        setSenderName("");
        setRecipientName("");
        setSubject("");
        setTagsInput("");
        setAttachedFile(null);
        loadLocalStorageFallback();
        setActiveTab("registry");
        return;
      }

      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast("New document securely logged into federal digital repository!");
        // Reset state
        setDocTitle("");
        setRefNo("");
        setBodyText("");
        setSenderName("");
        setRecipientName("");
        setSubject("");
        setTagsInput("");
        setAttachedFile(null);
        // Reload
        await loadAllData();
        setActiveTab("registry");
      } else {
        const errData = await res.json();
        showToast(`Intake failure: ${errData.error || 'Server rejected inputs.'}`, "warn");
      }
    } catch (err) {
      console.error(err);
      showToast("Network fault registering public record.", "warn");
    }
  };

  // Initiate a new physical movements dispatch voucher
  const handleDispatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoc) return;
    if (!transitToLocation || !transitToOfficer) {
      showToast("Receiver Department and Officer name must be declared.", "warn");
      return;
    }

    try {
      if (isUsingLocalStorageFallback) {
        const newMov: FileMovement = {
          id: `mov-${Date.now()}`,
          documentId: selectedDoc.id,
          refNo: selectedDoc.refNo,
          title: selectedDoc.title,
          fromLocation: selectedDoc.currentLocation,
          fromOfficer: selectedDoc.currentHandler,
          toLocation: transitToLocation,
          toOfficer: transitToOfficer,
          purpose: transitPurpose || "Administrative review",
          remarks: transitRemarks,
          dispatchTime: new Date().toISOString(),
          transitStatus: "dispatched"
        };
        const updatedMovs = [newMov, ...movements];
        localStorage.setItem("fed_movements", JSON.stringify(updatedMovs));

        const updatedDocs = documents.map(d => {
          if (d.id === selectedDoc.id) {
            return {
              ...d,
              currentLocation: "IN TRANSIT: " + transitToLocation,
              currentHandler: "Custodian: " + transitToOfficer,
              status: DocStatus.IN_PROGRESS
            };
          }
          return d;
        });
        localStorage.setItem("fed_documents", JSON.stringify(updatedDocs));

        const newLogObj: AuditLog = {
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          action: "FILE_MOVEMENT_DISPATCHED",
          userId: "nakato-001",
          userName: "Nakato Nakato",
          userEmail: "nakato.registry@publicservice.go.ug",
          details: `Dispatched physical document ${selectedDoc.refNo} ("${selectedDoc.title}") folder, marked index.`,
          severity: "info",
          refId: newMov.id
        };
        const updatedLogs = [newLogObj, ...logs];
        localStorage.setItem("fed_logs", JSON.stringify(updatedLogs));

        showToast(`Document marked as In Transit. Barcode verification voucher generated.`);
        setShowDispatchModal(false);
        setTransitToLocation("");
        setTransitToOfficer("");
        setTransitPurpose("");
        setTransitRemarks("");
        setSelectedDoc(null);
        setActiveTab("tracking");
        loadLocalStorageFallback();
        return;
      }

      const res = await fetch("/api/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: selectedDoc.id,
          toLocation: transitToLocation,
          toOfficer: transitToOfficer,
          purpose: transitPurpose,
          remarks: transitRemarks
        })
      });

      if (res.ok) {
        showToast(`Document marked as In Transit. Barcode verification voucher generated.`);
        setShowDispatchModal(false);
        // Clear forms
        setTransitToLocation("");
        setTransitToOfficer("");
        setTransitPurpose("");
        setTransitRemarks("");
        // Reload
        await loadAllData();
        // Keep focus on registry layout but clear selected
        setSelectedDoc(null);
        setActiveTab("tracking");
      } else {
        showToast("Failed to dispatch movement token. Please verify fields.", "warn");
      }
    } catch (err) {
      console.error(err);
      showToast("Network fault during courier dispatch.", "warn");
    }
  };

  // Complete a receipt check-in (signing-off transit)
  const handleAcknowledgeReceive = async (movementId: string) => {
    const signatureText = signType === "type" ? typedSignature : `DIGITAL_SIG:${sigCanvasPoints.length}_NODES`;
    if (signType === "type" && !typedSignature.trim()) {
      showToast("A named physical signature is required for electronic validation.", "warn");
      return;
    }
    if (signType === "draw" && sigCanvasPoints.length < 5) {
      showToast("Please draw a valid representative hand signature inside the canvas.", "warn");
      return;
    }

    try {
      if (isUsingLocalStorageFallback) {
        const updatedMovs = movements.map(m => {
          if (m.id === movementId) {
            return {
              ...m,
              receiveTime: new Date().toISOString(),
              transitStatus: "received" as const,
              receiverSignature: signatureText,
              remarks: `Hand-off complete on user terminal. Integrity verified.`
            };
          }
          return m;
        });
        localStorage.setItem("fed_movements", JSON.stringify(updatedMovs));

        const targetMov = movements.find(m => m.id === movementId);
        if (targetMov) {
          const updatedDocs = documents.map(d => {
            if (d.id === targetMov.documentId) {
              return {
                ...d,
                currentLocation: targetMov.toLocation,
                currentHandler: targetMov.toOfficer
              };
            }
            return d;
          });
          localStorage.setItem("fed_documents", JSON.stringify(updatedDocs));
        }

        const newLogObj: AuditLog = {
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          action: "FILE_MOVEMENT_RECEIVED",
          userId: "nakato-001",
          userName: "Nakato Nakato",
          userEmail: "nakato.registry@publicservice.go.ug",
          details: `Validated transfer receiver signoff for movement ledger token ${movementId}.`,
          severity: "info",
          refId: movementId
        };
        const updatedLogs = [newLogObj, ...logs];
        localStorage.setItem("fed_logs", JSON.stringify(updatedLogs));

        showToast("Verification complete! File checked-in and locked safely.");
        setShowReceiveModal(null);
        clearSignatureCanvas();
        loadLocalStorageFallback();
        return;
      }

      const res = await fetch(`/api/movements/${movementId}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signature: signatureText,
          remarks: `Hand-off complete on secure terminal. Integrity verified.`
        })
      });

      if (res.ok) {
        showToast("Verification complete! File checked-in and locked safely.");
        setShowReceiveModal(null);
        clearSignatureCanvas();
        await loadAllData();
      } else {
        showToast("Transit acknowledgement failed to update.", "warn");
      }
    } catch (err) {
      console.error(err);
      showToast("Network failure validating hand-off signature.", "warn");
    }
  };

  // Submit borrowing requisition request
  const handleBorrowRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqDocId || !reqRequestor || !reqEmail) {
      showToast("Requestor, Email, and File to requisition are mandatory fields.", "warn");
      return;
    }

    try {
      if (isUsingLocalStorageFallback) {
        const targetDoc = documents.find(d => d.id === reqDocId);
        const newReq: FileRequisition = {
          id: `req-${Date.now()}`,
          documentId: reqDocId,
          docRefNo: targetDoc ? targetDoc.refNo : "MPSD/TEMP/00",
          docTitle: targetDoc ? targetDoc.title : "Requisitioned Asset",
          requestorName: reqRequestor,
          requestorEmail: reqEmail,
          department: reqDept || "General Office Desk",
          requestDate: new Date().toISOString(),
          purpose: reqPurpose || "Policy evaluation audit.",
          neededUntil: reqDuration || new Date(Date.now() + 48*60*60*1000).toISOString().split('T')[0],
          status: "pending",
          isPhysical: reqPhysical
        };
        const updatedReqs = [newReq, ...requisitions];
        localStorage.setItem("fed_requisitions", JSON.stringify(updatedReqs));

        const newLogObj: AuditLog = {
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          action: "DOC_REGISTERED",
          userId: "nakato-001",
          userName: "Nakato Nakato",
          userEmail: "nakato.registry@publicservice.go.ug",
          details: `Requisition request logged under local index for digital ID ${reqDocId}.`,
          severity: "info",
          refId: newReq.id
        };
        const updatedLogs = [newLogObj, ...logs];
        localStorage.setItem("fed_logs", JSON.stringify(updatedLogs));

        showToast("Requisition received. Awaiting central senior archivist approval.");
        setShowReqModal(false);
        setReqRequestor("");
        setReqEmail("");
        setReqDept("");
        setReqPurpose("");
        setReqDuration("");
        loadLocalStorageFallback();
        return;
      }

      const res = await fetch("/api/requisitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: reqDocId,
          requestorName: reqRequestor,
          requestorEmail: reqEmail,
          department: reqDept || "General Office Desk",
          purpose: reqPurpose || "Policy evaluation audit.",
          neededUntil: reqDuration || new Date(Date.now() + 48*60*60*1000).toISOString().split('T')[0],
          isPhysical: reqPhysical
        })
      });

      if (res.ok) {
        showToast("Requisition received. Awaiting central senior archivist approval.");
        setShowReqModal(false);
        setReqRequestor("");
        setReqEmail("");
        setReqDept("");
        setReqPurpose("");
        setReqDuration("");
        await loadAllData();
      } else {
        showToast("Failed to register requisition token.", "warn");
      }
    } catch (err) {
      console.error(err);
      showToast("Network failure transmitting search-slip request.", "warn");
    }
  };

  // Process a requisition action (Approve, Issue, Return, Reject)
  const handleRequisitionWorkflow = async (id: string, workflowStatus: "approved" | "issued" | "returned" | "rejected", remarks = "") => {
    try {
      if (isUsingLocalStorageFallback) {
        let docIdToUpdate: string | undefined;
        let statusToSet: DocStatus | undefined;

        const updatedReqs = requisitions.map(r => {
          if (r.id === id) {
            docIdToUpdate = r.documentId;
            const updated = {
              ...r,
              status: workflowStatus,
              approvedBy: "Senior Registrar Nakato",
              actionRemarks: remarks || `Status changed to ${workflowStatus} successfully in standard logs.`
            } as FileRequisition;
            if (workflowStatus === "issued") {
              updated.issuedTime = new Date().toISOString();
              statusToSet = DocStatus.IN_PROGRESS;
            } else if (workflowStatus === "returned") {
              updated.returnedTime = new Date().toISOString();
              statusToSet = DocStatus.REGISTERED;
            } else if (workflowStatus === "rejected") {
              statusToSet = DocStatus.REGISTERED;
            }
            return updated;
          }
          return r;
        });
        localStorage.setItem("fed_requisitions", JSON.stringify(updatedReqs));

        if (docIdToUpdate && statusToSet) {
          const updatedDocs = documents.map(d => {
            if (d.id === docIdToUpdate) {
              return {
                ...d,
                status: statusToSet!
              };
            }
            return d;
          });
          localStorage.setItem("fed_documents", JSON.stringify(updatedDocs));
        }

        const newLogObj: AuditLog = {
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          action: "FILE_MOVEMENT_RECEIVED",
          userId: "nakato-001",
          userName: "Nakato Nakato",
          userEmail: "nakato.registry@publicservice.go.ug",
          details: `Requisition action adjusted state locally: ${workflowStatus.toUpperCase()}`,
          severity: "info",
          refId: id
        };
        const updatedLogs = [newLogObj, ...logs];
        localStorage.setItem("fed_logs", JSON.stringify(updatedLogs));

        showToast(`Registry state marked: ${workflowStatus.toUpperCase()}!`);
        loadLocalStorageFallback();
        return;
      }

      const res = await fetch(`/api/requisitions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: workflowStatus,
          actionRemarks: remarks || `Status changed to ${workflowStatus} successfully in standard logs.`,
          approvedBy: "Senior Registrar Nakato"
        })
      });

      if (res.ok) {
        showToast(`Registry state marked: ${workflowStatus.toUpperCase()}!`);
        await loadAllData();
      } else {
        showToast("Requisition adjustment rejected by server.", "warn");
      }
    } catch (err) {
      console.error(err);
      showToast("Connection issue adjusting requisition levels.", "warn");
    }
  };

  // Purge/Delete a faulty document (requires double confirmation)
  const handleDeleteDocument = async (id: string) => {
    if (!window.confirm("CRITICAL ADMIN WARNING:\nAre you sure you want to permanently delete this government document from the digital repository? This leaves a permanent red mark on the audit log ledger.")) {
      return;
    }
    try {
      if (isUsingLocalStorageFallback) {
        const updatedDocs = documents.filter(d => d.id !== id);
        localStorage.setItem("fed_documents", JSON.stringify(updatedDocs));

        const newLogObj: AuditLog = {
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          action: "DOC_PURGED",
          userId: "nakato-001",
          userName: "Nakato Nakato",
          userEmail: "nakato.registry@publicservice.go.ug",
          details: `Urgent Audit purges document ID: ${id}`,
          severity: "warning",
          refId: id
        };
        const updatedLogs = [newLogObj, ...logs];
        localStorage.setItem("fed_logs", JSON.stringify(updatedLogs));

        showToast("Official file purged completely from repository indices.", "warn");
        setSelectedDoc(null);
        loadLocalStorageFallback();
        return;
      }

      const res = await fetch(`/api/documents/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        showToast("Official file purged completely from repository indices.", "warn");
        setSelectedDoc(null);
        await loadAllData();
      } else {
        showToast("Purge request rejected. High-privilege clearance required.", "warn");
      }
    } catch (err) {
      console.error(err);
      showToast("Network error executing deletion audit.", "warn");
    }
  };

  // Filter Document List Array
  const getFilteredDocuments = () => {
    return documents.filter(doc => {
      const matchSearch = 
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.refNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.senderName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (doc.tags && doc.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())));
      
      const matchDirection = filterDirection === "all" || doc.direction === filterDirection;
      const matchType = filterType === "all" || doc.docType === filterType;
      const matchSecurity = filterSecurity === "all" || doc.securityClassification === filterSecurity;
      const matchPriority = filterPriority === "all" || doc.priority === filterPriority;

      return matchSearch && matchDirection && matchType && matchSecurity && matchPriority;
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-emerald-100 selection:text-emerald-950">
      
      {/* 1. FEDERAL HEADER / CIVIL SERVICE BRAND BAR */}
      <header className="bg-[#0f172a] text-white shadow-xl border-b-4 border-emerald-600 relative overflow-hidden z-20">
        <div className="absolute top-0 left-0 w-2 h-full bg-amber-500"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            
            <div className="flex items-center gap-4">
              <div className="bg-emerald-600 p-2.5 rounded-lg border-2 border-emerald-400 shadow-inner flex items-center justify-center text-white shrink-0">
                <Database className="w-8 h-8" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold tracking-widest text-amber-500 uppercase bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                    National Civil Service Registry
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 block delicate-pulse"></span>
                    <span>Classified Ledger Synced</span>
                  </div>
                </div>
                <h1 className="text-2xl font-bold tracking-tight mt-0.5 font-mono">
                  Gov<span className="text-emerald-400 font-sans">Registry</span> DMS
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Official automated registry infrastructure conforming to the National Data Management Charter.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="bg-slate-800/80 border border-slate-700 rounded-md px-3 py-1.5 text-right hidden xl:block">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">Registry Officer Station</div>
                <div className="text-xs font-medium text-emerald-300">Senior Registrar N. Nakato</div>
              </div>
              
              <button 
                onClick={loadAllData} 
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white px-3 py-2 rounded-md text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50"
                disabled={refreshing}
                title="Sync and Refresh Ledger"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                <span>Sync</span>
              </button>

              <button 
                onClick={() => {
                  setReqDocId(documents[0]?.id || "");
                  setShowReqModal(true);
                }} 
                className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-semibold px-3.5 py-2 rounded-md text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md"
              >
                <Plus className="w-4 h-4 text-slate-950" />
                <span>New Borrow Slip</span>
              </button>

              <button 
                onClick={() => {
                  // Reset form to defaults and switch view
                  setDocTitle("");
                  setBodyText("");
                  setAttachedFile(null);
                  setRefNo("");
                  setSubject("");
                  setActiveTab("intake");
                }} 
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 py-2 rounded-md text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md"
              >
                <Sparkles className="w-4 h-4 text-emerald-200" />
                <span>Digital Intake Register</span>
              </button>

            </div>
          </div>
        </div>

        {/* METRIC RIBBON / TABS NAVIGATION */}
        <div className="bg-slate-900 border-t border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex space-x-1 py-1.5 overflow-x-auto select-none" aria-label="Tabs">
              <button
                onClick={() => setActiveTab("overview")}
                className={`py-2 px-3.5 rounded-md text-xs font-medium cursor-pointer transition flex items-center gap-2 shrink-0 ${
                  activeTab === "overview"
                    ? "bg-slate-800 text-emerald-400 border border-slate-700"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Command Dashboard</span>
              </button>

              <button
                onClick={() => setActiveTab("registry")}
                className={`py-2 px-3.5 rounded-md text-xs font-medium cursor-pointer transition flex items-center gap-2 shrink-0 ${
                  activeTab === "registry"
                    ? "bg-slate-800 text-emerald-400 border border-slate-700"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Digital Ledger Book</span>
                <span className="bg-slate-900 text-[10px] text-slate-400 px-1.5 py-0.2 rounded border border-slate-700">
                  {documents.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab("intake")}
                className={`py-2 px-3.5 rounded-md text-xs font-medium cursor-pointer transition flex items-center gap-2 shrink-0 ${
                  activeTab === "intake"
                    ? "bg-slate-800 text-emerald-400 border border-slate-700"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Intake Wizard</span>
              </button>

              <button
                onClick={() => setActiveTab("tracking")}
                className={`py-2 px-3.5 rounded-md text-xs font-medium cursor-pointer transition flex items-center gap-2 shrink-0 ${
                  activeTab === "tracking"
                    ? "bg-slate-800 text-emerald-400 border border-slate-700"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>Live Movements Tracking</span>
                {analytics.pendingMovements > 0 && (
                  <span className="bg-amber-500 text-[9px] text-slate-950 font-bold px-1.5 py-0.2 rounded-full">
                    {analytics.pendingMovements} active
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab("requisitions")}
                className={`py-2 px-3.5 rounded-md text-xs font-medium cursor-pointer transition flex items-center gap-2 shrink-0 ${
                  activeTab === "requisitions"
                    ? "bg-slate-800 text-emerald-400 border border-slate-700"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                }`}
              >
                <Fingerprint className="w-3.5 h-3.5" />
                <span>Custody & Requisitions</span>
                {analytics.requisitionsCount.pending > 0 && (
                  <span className="bg-red-500 text-[9px] text-white font-bold px-1.5 py-0.2 rounded-full">
                    {analytics.requisitionsCount.pending} new
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab("audit")}
                className={`py-2 px-3.5 rounded-md text-xs font-medium cursor-pointer transition flex items-center gap-2 shrink-0 ${
                  activeTab === "audit"
                    ? "bg-slate-800 text-emerald-400 border border-slate-700"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>System Audits Log</span>
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* 2. MAIN WORKSPACE */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 relative">
        
        {/* TOAST SYSTEM */}
        {notification && (
          <div className="fixed bottom-5 right-5 z-50 max-w-md bg-slate-900 border border-slate-800 rounded-lg shadow-2xl p-4 flex items-start gap-3 animate-bounce">
            {notification.type === "success" && <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />}
            {notification.type === "warn" && <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />}
            {notification.type === "info" && <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />}
            <div>
              <p className="text-sm font-semibold text-white">Registry Notification</p>
              <p className="text-xs text-slate-300 mt-1">{notification.message}</p>
            </div>
            <button 
              onClick={() => setNotification(null)}
              className="text-slate-400 hover:text-white ml-auto cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* LOADER SKELETON SCREEN */}
        {loading ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(idx => (
                <div key={idx} className="h-28 bg-white border border-slate-200 rounded-lg animate-pulse" />
              ))}
            </div>
            <div className="h-96 bg-white border border-slate-200 rounded-lg animate-pulse" />
          </div>
        ) : (
          <div className="space-y-6">



            {/* ==========================================
                VIEW 1: COMMAND OVERVIEW DASHBOARD
                ========================================== */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                
                {/* METRIC SCORECARDS GRID */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  
                  <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm relative overflow-hidden flex flex-col justify-between">
                    <div className="absolute top-0 right-0 p-3 text-slate-100"><Inbox className="w-12 h-12" /></div>
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">Secured Inward</span>
                      <div className="text-3xl font-extrabold text-slate-900 mt-1 font-mono">{analytics.totalIncoming}</div>
                    </div>
                    <div className="mt-2 text-xs text-emerald-600 font-medium flex items-center gap-1">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      <span>Processed & Indexed</span>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm relative overflow-hidden flex flex-col justify-between">
                    <div className="absolute top-0 right-0 p-3 text-slate-100"><Send className="w-12 h-12" /></div>
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">Secured Outgoing</span>
                      <div className="text-3xl font-extrabold text-slate-900 mt-1 font-mono">{analytics.totalOutgoing}</div>
                    </div>
                    <div className="mt-2 text-xs text-blue-600 font-medium flex items-center gap-1">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                      <span>Dispatched Cleanly</span>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm relative overflow-hidden flex flex-col justify-between">
                    <div className="absolute top-0 right-0 p-3 text-slate-100"><MapPin className="w-12 h-12" /></div>
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">In Transit State</span>
                      <div className="text-3xl font-extrabold text-[#d97706] mt-1 font-mono">{analytics.pendingMovements}</div>
                    </div>
                    <div className="mt-2 text-xs flex items-center gap-1 font-semibold text-slate-500">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                      <span>On Track Hand-off</span>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm relative overflow-hidden flex flex-col justify-between">
                    <div className="absolute top-0 right-0 p-3 text-slate-100"><Fingerprint className="w-12 h-12" /></div>
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">Active Borrow Slips</span>
                      <div className="text-3xl font-extrabold text-slate-900 mt-1 font-mono">
                        {analytics.requisitionsCount.approved + analytics.requisitionsCount.issued}
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-slate-500 flex items-center gap-1">
                      <span>{analytics.requisitionsCount.pending} pending slips</span>
                    </div>
                  </div>

                </div>

                {/* BENTO GRID DETAILS - MAIN CHART AND CONTROLS */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Left Column - High-fidelity visual breakdown of archives */}
                  <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-5">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest font-mono">Document Volume Analysis</h3>
                      <p className="text-xs text-slate-500 mt-0.5">Classification split across letter registers, folders, and formal files.</p>
                    </div>

                    <div className="space-y-5">
                      <SimpleBarChart 
                        data={[
                          { label: "Letters & Correspondence", value: analytics.totalLetters },
                          { label: "Case Folders & Permanent Files", value: analytics.totalFiles },
                          { label: "Executive Reports", value: analytics.totalReports }
                        ]} 
                        labelKey="label" 
                        valueKey="value" 
                        colorClass="bg-gradient-to-r from-emerald-600 to-emerald-400"
                      />

                      <hr className="border-slate-100" />

                      {/* Security classification status bars */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Security Classification Guard</h4>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          <div className="bg-slate-50 p-2 rounded border border-slate-200">
                            <span className="text-[10px] text-slate-500 uppercase font-mono block">Secret</span>
                            <span className="text-sm font-bold text-red-600 font-mono">{analytics.bySecurity.secret} dossiers</span>
                          </div>
                          <div className="bg-slate-50 p-2 rounded border border-slate-200">
                            <span className="text-[10px] text-slate-500 uppercase font-mono block">Confidential</span>
                            <span className="text-sm font-bold text-amber-600 font-mono">{analytics.bySecurity.confidential} dossiers</span>
                          </div>
                          <div className="bg-slate-50 p-2 rounded border border-slate-200">
                            <span className="text-[10px] text-slate-500 uppercase font-mono block">Restricted</span>
                            <span className="text-sm font-bold text-blue-600 font-mono">{analytics.bySecurity.restricted} dossiers</span>
                          </div>
                          <div className="bg-slate-50 p-2 rounded border border-slate-200">
                            <span className="text-[10px] text-slate-500 uppercase font-mono block">Open Policy</span>
                            <span className="text-sm font-bold text-slate-700 font-mono">{analytics.bySecurity.open} dossiers</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Middle and Right Column - Active In-Transit & Borrow movements */}
                  <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest font-mono">Live File Movement Terminal</h3>
                        <p className="text-xs text-slate-500">Unresolved transits across desks and physical custody boundaries.</p>
                      </div>
                      <span className="bg-amber-100 text-[#b45309] text-[10px] font-bold px-2 py-0.5 rounded border border-amber-200/50 uppercase font-mono">
                        Active Desks
                      </span>
                    </div>

                    <div className="space-y-4 max-h-[440px] overflow-y-auto pr-1">
                      {movements.filter(m => m.transitStatus !== "received").length === 0 ? (
                        <div className="text-center py-10 bg-slate-50 border border-slate-200 border-dashed rounded-lg">
                          <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto" />
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest mt-2 font-mono">ALL TRANSITS SECURE</h4>
                          <p className="text-[11px] text-slate-500 max-w-sm mx-auto mt-0.5">
                            Every single physical movement has been electronic signed-off and locked into destination lockers without open warnings.
                          </p>
                        </div>
                      ) : (
                        movements.filter(m => m.transitStatus !== "received").map((mov) => {
                          const isOverdue = false;
                          return (
                            <div 
                              key={mov.id} 
                              className={`p-3.5 rounded-lg border flex flex-col md:flex-row md:items-center md:justify-between gap-3 ${
                                isOverdue ? 'bg-red-50/70 border-red-200' : 'bg-slate-50 border-slate-200'
                              }`}
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-900 tracking-tight">{mov.refNo}</span>
                                  {isOverdue && (
                                    <span className="bg-red-600 text-white font-mono text-[9px] font-bold px-1.5 py-0.1 select-none rounded animate-pulse uppercase">
                                      SLA Overdue
                                    </span>
                                  )}
                                </div>
                                <h4 className="text-xs font-semibold text-slate-800 line-clamp-1">{mov.title}</h4>
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
                                  <span className="font-medium text-slate-700">{mov.fromOfficer} ({mov.fromLocation})</span>
                                  <ArrowRight className="w-3 h-3 text-slate-400" />
                                  <span className="font-semibold text-emerald-700">{mov.toOfficer} ({mov.toLocation})</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
                                <button
                                  onClick={() => setShowReceiveModal(mov)}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-1.5 rounded flex items-center gap-1 cursor-pointer transition"
                                >
                                  <Fingerprint className="w-3.5 h-3.5 text-emerald-200" />
                                  <span>Verify Signature</span>
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                    
                    <div className="pt-2 text-[11px] text-center text-slate-400 border-t border-slate-100 flex items-center justify-center gap-1.5">
                      <BarcodeText text="LEDI-3920-BAR" classPrefix="h-3" />
                      <span>Electronic ledger tracking vouchers avoid paper index book misplacements.</span>
                    </div>

                  </div>

                </div>

                {/* RECENT TRANSACTION TRAIL / AUDIT SNIPPETS */}
                <div className="bg-slate-900 text-white rounded-lg p-5 border border-slate-800 shadow-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 delicate-pulse"></div>
                      <h3 className="text-xs font-bold uppercase tracking-widest font-mono">Live Secure Compliance Ledger Feed</h3>
                    </div>
                    <button 
                      onClick={() => setActiveTab("audit")} 
                      className="text-[10px] text-emerald-400 hover:text-emerald-300 uppercase tracking-widest font-mono font-medium hover:underline cursor-pointer"
                    >
                      Inspect Full Registry Records
                    </button>
                  </div>

                  <div className="divide-y divide-slate-800 max-h-48 overflow-y-auto pr-2 font-mono text-[11px]">
                    {logs.slice(0, 3).map((log) => (
                      <div key={log.id} className="py-2.5 flex items-start gap-3">
                        <span className="text-slate-500 shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                        <span className={`font-bold select-none shrink-0 ${
                          log.severity === 'alert' ? 'text-red-400' : log.severity === 'warning' ? 'text-amber-400' : 'text-emerald-400'
                        }`}>
                          [{log.action}]
                        </span>
                        <p className="text-slate-300 break-words">{log.details}</p>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}


            {/* ==========================================
                VIEW 2: THE DIGITAL REGISTRY BOOK (LISTING)
                ========================================== */}
            {activeTab === "registry" && (
              <div className="space-y-6">
                
                {/* ADVANCED MULTI-COLUMN CONTROLS BAND */}
                <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm space-y-3">
                  <div className="flex flex-col md:flex-row gap-3">
                    
                    {/* Main search */}
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        placeholder="Search document registry... (Subject, Ref Number, Sender Name, or Archive Tags)"
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                      {searchQuery && (
                        <button 
                          onClick={() => setSearchQuery("")} 
                          className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Filter reset */}
                    {(filterDirection !== "all" || filterType !== "all" || filterSecurity !== "all" || filterPriority !== "all" || searchQuery) && (
                      <button
                        onClick={() => {
                          setFilterDirection("all");
                          setFilterType("all");
                          setFilterSecurity("all");
                          setFilterPriority("all");
                          setSearchQuery("");
                        }}
                        className="bg-slate-100 hover:bg-slate-200 hover:text-slate-800 text-slate-600 px-3 py-2 rounded text-xs transition font-mono"
                      >
                        Reset Filters
                      </button>
                    )}

                  </div>

                  {/* Collapsed/Expanded Multi Filters */}
                  <div className="flex flex-wrap items-center gap-3 bg-slate-50/50 p-2.5 rounded border border-slate-100 text-xs">
                    <span className="font-bold text-slate-500 font-mono text-[10px] uppercase flex items-center gap-1">
                      <Filter className="w-3 h-3" /> Filters State:
                    </span>
                    
                    {/* Direction */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 text-[10px]">Flow:</span>
                      <select 
                        className="bg-white border border-slate-200 rounded px-1.5 py-1 text-slate-800 text-xs"
                        value={filterDirection}
                        onChange={(e) => setFilterDirection(e.target.value)}
                      >
                        <option value="all">All Correspondence</option>
                        <option value="incoming">Incoming Hand-off</option>
                        <option value="outgoing">Outgoing Dispatch</option>
                      </select>
                    </div>

                    {/* Type */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 text-[10px]">Registry Category:</span>
                      <select 
                        className="bg-white border border-slate-200 rounded px-1.5 py-1 text-slate-800 text-xs"
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                      >
                        <option value="all">All Formats</option>
                        <option value="letter">Letters & Letters</option>
                        <option value="file">Cabinet Folders</option>
                        <option value="report">Analytic Reports</option>
                      </select>
                    </div>

                    {/* Security */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 text-[10px]">Security Guard:</span>
                      <select 
                        className="bg-white border border-slate-200 rounded px-1.5 py-1 text-slate-800 text-xs text-mono"
                        value={filterSecurity}
                        onChange={(e) => setFilterSecurity(e.target.value)}
                      >
                        <option value="all">All Clearance</option>
                        <option value="open">Open / Public</option>
                        <option value="restricted">Restricted Policies</option>
                        <option value="confidential">Confidential</option>
                        <option value="secret">Secret Vault Only</option>
                      </select>
                    </div>

                    {/* Priority */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 text-[10px]">SLA Priority:</span>
                      <select 
                        className="bg-white border border-slate-200 rounded px-1.5 py-1 text-slate-800 text-xs"
                        value={filterPriority}
                        onChange={(e) => setFilterPriority(e.target.value)}
                      >
                        <option value="all">All Speeds</option>
                        <option value="low">Standard Check</option>
                        <option value="medium">Medium Handback</option>
                        <option value="high">Priority Clearance</option>
                        <option value="immediate">Immediate Dispatch</option>
                      </select>
                    </div>

                  </div>

                </div>

                {/* LEDGER AND DETAILS PANEL */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Left-Side: The Digital Register Table Book */}
                  <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm lg:col-span-2">
                    <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest font-mono">
                        Unified National Digital Register Index
                      </h3>
                      <span className="text-[11px] text-slate-500 font-mono font-medium">
                        Showing {getFilteredDocuments().length} matching documents
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-slate-700 divide-y divide-slate-200">
                        <thead className="bg-[#1e293b] text-white font-mono text-[10px] uppercase tracking-wider select-none">
                          <tr>
                            <th className="px-4 py-3">Official Ref No / Title</th>
                            <th className="px-4 py-3">Direct Flow</th>
                            <th className="px-4 py-3">Cabinet Format</th>
                            <th className="px-4 py-3">Security & SLA</th>
                            <th className="px-4 py-3 text-right">Custodian Desk</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                          {getFilteredDocuments().length === 0 ? (
                            <tr>
                              <td colSpan={5} className="text-center py-16 text-slate-400">
                                <FileX className="w-10 h-10 mx-auto text-slate-300" />
                                <p className="mt-2 text-xs font-bold text-slate-700 font-mono uppercase">Empty Ledger Matches</p>
                                <p className="text-[11px] text-slate-500">Simplify your filters or register a new document code.</p>
                              </td>
                            </tr>
                          ) : (
                            getFilteredDocuments().map((doc) => {
                              const isSelected = selectedDoc?.id === doc.id;
                              return (
                                <tr 
                                  key={doc.id} 
                                  onClick={() => setSelectedDoc(doc)}
                                  className={`hover:bg-slate-50/80 cursor-pointer transition-colors ${
                                    isSelected ? "bg-emerald-50/45 border-l-4 border-l-emerald-600" : ""
                                  }`}
                                >
                                  <td className="px-4 py-3.5 space-y-1">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-mono text-slate-900 font-bold tracking-tight">{doc.refNo}</span>
                                      {doc.fileName && (
                                        <span className="bg-slate-100 text-slate-500 text-[9px] px-1 py-0.1 border rounded font-mono" title={doc.fileName}>
                                          Scan
                                        </span>
                                      )}
                                    </div>
                                    <p className="font-semibold text-slate-800 leading-tight line-clamp-1">{doc.title}</p>
                                    <p className="text-[10px] text-slate-500 truncate">From: {doc.senderName}</p>
                                  </td>
                                  
                                  <td className="px-4 py-3.5">
                                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                                      doc.direction === DocDirection.INCOMING 
                                        ? 'bg-teal-50 text-teal-700 border border-teal-200' 
                                        : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                    }`}>
                                      {doc.direction === DocDirection.INCOMING ? <Inbox className="w-2.5 h-2.5" /> : <Send className="w-2.5 h-2.5" />}
                                      {doc.direction}
                                    </span>
                                  </td>

                                  <td className="px-4 py-3.5">
                                    <span className="text-slate-700 font-medium capitalize flex items-center gap-1 text-[11px]">
                                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                                      {doc.docType}
                                    </span>
                                  </td>

                                  <td className="px-4 py-3.5 space-y-1 select-none">
                                    {/* Security badge and Priority */}
                                    <div className="flex items-center gap-1.5">
                                      <span className={`text-[9px] font-bold font-mono px-1.5 py-0.1 border rounded ${
                                        doc.securityClassification === SecurityClassification.SECRET 
                                          ? "bg-red-900/10 border-red-300 text-red-600"
                                          : doc.securityClassification === SecurityClassification.CONFIDENTIAL
                                          ? "bg-amber-900/10 border-amber-300 text-amber-600"
                                          : "bg-slate-100 border-slate-300 text-slate-600"
                                      }`}>
                                        {doc.securityClassification}
                                      </span>
                                      
                                      <span className={`w-1.5 h-1.5 rounded-full ${
                                        doc.priority === Priority.IMMEDIATE 
                                          ? 'bg-red-500' 
                                          : doc.priority === Priority.HIGH 
                                          ? 'bg-amber-500' 
                                          : 'bg-emerald-500'
                                      }`} title={`SLA Priority: ${doc.priority}`} />
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-mono">
                                      {new Date(doc.receivedDate).toLocaleDateString()}
                                    </div>
                                  </td>

                                  <td className="px-4 py-3.5 text-right space-y-0.5">
                                    <div className="text-xs font-semibold text-slate-800 line-clamp-1">{doc.currentHandler}</div>
                                    <div className="text-[10px] text-slate-500 font-medium">{doc.currentLocation}</div>
                                    <span className={`inline-block text-[9px] font-mono px-1.5 py-0.2 rounded ${
                                      doc.status === DocStatus.CLOSED 
                                        ? 'bg-slate-200 text-slate-700' 
                                        : doc.status === DocStatus.DISPATCHED 
                                        ? 'bg-amber-100 text-[#b45309]'
                                        : 'bg-emerald-100 text-emerald-800'
                                    }`}>
                                      {doc.status}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Right-Side: Highly Detailed Ledger Folder Metadata Drawer */}
                  <div className="space-y-4">
                    {selectedDoc ? (
                      <div className="bg-white border-2 border-slate-200 rounded-lg p-5 shadow-lg space-y-4 sticky top-6">
                        
                        {/* Header metadata layout */}
                        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold font-mono bg-slate-900 text-emerald-400 px-2 py-0.5 rounded border border-slate-800">
                              Official File Dossier
                            </span>
                            <div className="font-mono text-sm font-bold text-slate-900 tracking-tight mt-1">{selectedDoc.refNo}</div>
                          </div>
                          <button 
                            onClick={() => setSelectedDoc(null)}
                            className="text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 p-1 rounded cursor-pointer"
                          >
                            <X className="w-4.5 h-4.5" />
                          </button>
                        </div>

                        {/* Title and Subject summary */}
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-slate-900 leading-tight">{selectedDoc.title}</h4>
                          <p className="text-xs text-slate-500 font-mono">Current Status: <span className="font-bold text-emerald-700 capitalize">{selectedDoc.status}</span></p>
                        </div>

                        <hr className="border-slate-100" />

                        {/* Summary OCR contents */}
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Archival Abstract (Summary)</span>
                          <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded border border-slate-200/50 italic leading-relaxed">
                            {selectedDoc.subject || "No digital summary generated yet for this government record index."}
                          </p>
                        </div>

                        {/* Logistics details */}
                        <div className="grid grid-cols-2 gap-3.5 text-xs text-slate-700">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block">Correspondent Source</span>
                            <span className="font-medium line-clamp-1" title={selectedDoc.senderName}>{selectedDoc.senderName}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block">Designated Consignee</span>
                            <span className="font-medium line-clamp-1" title={selectedDoc.recipientName}>{selectedDoc.recipientName}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block">Custodian Location</span>
                            <span className="font-semibold text-slate-900">{selectedDoc.currentLocation}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block">Direct Handler</span>
                            <span className="font-semibold text-slate-900">{selectedDoc.currentHandler}</span>
                          </div>
                        </div>

                        {/* Barcode Routing voucher preview */}
                        <div className="bg-slate-50 border border-slate-200 rounded p-3 select-none flex flex-col items-center justify-center space-y-1 text-center">
                          <QrCode className="w-12 h-12 text-slate-700 stroke-1" />
                          <BarcodeText text={selectedDoc.refNo} />
                          <span className="text-[8px] tracking-wider text-slate-400 uppercase font-mono">Barcode Transit Verification Stamp</span>
                        </div>

                        {/* Action buttons (Direct transit checkout or archive requisitions) */}
                        <div className="pt-2 grid grid-cols-2 gap-2">
                          
                          <button
                            onClick={() => {
                              setTransitToLocation("");
                              setTransitToOfficer("");
                              setTransitPurpose("");
                              setTransitRemarks("");
                              setShowDispatchModal(true);
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 rounded flex items-center justify-center gap-1.5 cursor-pointer transition"
                            disabled={selectedDoc.status === DocStatus.DISPATCHED}
                          >
                            <Send className="w-3.5 h-3.5 text-emerald-200" />
                            <span>Dispatch Folder</span>
                          </button>

                          <button
                            onClick={() => {
                              setReqDocId(selectedDoc.id);
                              setReqRequestor("");
                              setReqEmail("");
                              setReqDept("");
                              setReqPurpose("");
                              setReqDuration("");
                              setShowReqModal(true);
                            }}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2 rounded flex items-center justify-center gap-1.5 cursor-pointer transition border border-slate-300"
                          >
                            <Fingerprint className="w-3.5 h-3.5 text-slate-400" />
                            <span>Borrow Request</span>
                          </button>

                        </div>

                        <hr className="border-slate-100" />

                        {/* Deletion audit trail */}
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-400">Arched on: {new Date(selectedDoc.createdTime || selectedDoc.receivedDate).toLocaleDateString()}</span>
                          <button 
                            onClick={() => handleDeleteDocument(selectedDoc.id)}
                            className="text-red-600 hover:text-red-700 font-mono hover:underline text-[10px] uppercase font-bold tracking-wider cursor-pointer"
                          >
                            Purge Records
                          </button>
                        </div>

                      </div>
                    ) : (
                      <div className="bg-white border border-slate-200 rounded-lg p-6 text-center text-slate-400 flex flex-col items-center justify-center h-80 shadow-sm border-dashed">
                        <BookOpen className="w-12 h-12 text-slate-300 stroke-1 mb-2" />
                        <h4 className="text-xs font-bold text-slate-750 uppercase tracking-widest font-mono">No Document Selected</h4>
                        <p className="text-[11px] text-slate-500 max-w-xs mt-1">
                          Click any row in the Digital Register ledger book to reveal classification notes, OCR digests, barcoded routing credentials, and hand-off records.
                        </p>
                      </div>
                    )}
                  </div>

                </div>

              </div>
            )}


            {/* ==========================================
                VIEW 3: THE AUTOMATED AI INTAKE REGISTER
                ========================================== */}
            {activeTab === "intake" && (
              <div className="space-y-6">
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Left Column: Sample templates and Drag Drop interface */}
                  <div className="space-y-6">
                    
                    {/* Sample template selector to prevent empty typing */}
                    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm space-y-3">
                      <div>
                        <h3 className="text-xs font-bold text-slate-950 uppercase tracking-widest font-mono">Sample Letters & Directives</h3>
                        <p className="text-[11px] text-slate-500">Select standard civilian/ministerial correspondence template definitions to witness AI classifier capabilities instantly.</p>
                      </div>

                      <div className="space-y-2">
                        {sampleLetters.map((sample) => (
                          <button
                            key={sample.id}
                            onClick={() => loadSample(sample)}
                            className="w-full text-left p-2.5 rounded border border-slate-200/60 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 transition text-xs space-y-1 block cursor-pointer group"
                          >
                            <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 group-hover:text-emerald-700">
                              <span>{sample.source}</span>
                              <span className="bg-slate-200 text-slate-700 px-1 rounded uppercase scale-90">{sample.docType}</span>
                            </div>
                            <div className="font-semibold text-slate-800 line-clamp-1 group-hover:text-slate-900">{sample.title}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Drag-drop simulation */}
                    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm space-y-3">
                      <h3 className="text-xs font-bold text-slate-950 uppercase tracking-widest font-mono">Digital Document Scanning</h3>
                      
                      <div 
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`border-2 border-dashed rounded-lg p-5 text-center transition cursor-pointer flex flex-col items-center justify-center space-y-2 ${
                          dragOver ? "border-emerald-500 bg-emerald-50/50" : "border-slate-300 bg-slate-55/40 hover:bg-slate-50"
                        }`}
                        onClick={() => document.getElementById('digitalFileInput')?.click()}
                      >
                        <Upload className="w-8 h-8 text-slate-400" />
                        <div>
                          <p className="text-xs font-bold text-slate-800">Drag & Drop files here, or click to find</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">Supports PDF scans, DOCX circulars, or TXT memos (Max 15MB)</p>
                        </div>
                        <input 
                          id="digitalFileInput"
                          type="file" 
                          className="hidden" 
                          accept=".pdf,.txt,.docx,.doc,image/*"
                          onChange={handleFileInput}
                        />
                      </div>

                      {attachedFile && (
                        <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-emerald-700" />
                            <div className="space-y-0.5">
                              <p className="font-semibold text-slate-800 line-clamp-1">{attachedFile.name}</p>
                              <p className="text-[10px] text-slate-500 font-mono">{attachedFile.size}</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => {
                              setAttachedFile(null);
                              showToast("Scanning file detached from temporary indexing memory.");
                            }}
                            className="text-slate-400 hover:text-red-600 cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                    </div>

                  </div>

                  {/* Middle and Right: The Comprehensive Digital Wizard Register Intake Form */}
                  <div className="bg-white border border-slate-200 rounded-lg shadow-sm lg:col-span-2 overflow-hidden">
                    <div className="bg-[#1e293b] text-white px-5 py-3.5 border-b border-slate-700 flex justify-between items-center flex-wrap gap-2">
                      <div className="space-y-0.5">
                        <h3 className="text-xs font-bold uppercase tracking-widest font-mono text-emerald-400">National Government Registry Filing</h3>
                        <p className="text-[11px] text-slate-400">Secure new correspondence into active server queues adhering to the Data Protection Act.</p>
                      </div>
                      
                      {/* AI integration trigger */}
                      <button
                        type="button"
                        onClick={triggerAIAnalyze}
                        disabled={aiAnalyzing}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3.5 py-1.5 rounded flex items-center gap-1.5 cursor-pointer shadow border border-emerald-500 transition disabled:opacity-50 delicate-pulse"
                      >
                        <Sparkles className={`w-3.5 h-3.5 text-emerald-200 ${aiAnalyzing ? 'animate-spin' : ''}`} />
                        <span>{aiAnalyzing ? "Analyzing Text..." : "Analyze with AI Guide"}</span>
                      </button>

                    </div>

                    <form onSubmit={handleIntakeSubmit} className="p-5 space-y-4">
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        
                        {/* Draft Title */}
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Document Title / Brief (Required)</label>
                          <input 
                            type="text" 
                            required
                            placeholder="e.g., Draft Budget Circular recurrent expenditure ceilings"
                            className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-2 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                            value={docTitle}
                            onChange={(e) => setDocTitle(e.target.value)}
                          />
                        </div>

                        {/* File Ref Number */}
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center justify-between">
                            <span>Official Registry Ref (Required)</span>
                            <span className="text-[10px] text-amber-600 font-mono lower-case">Locked on auto-analyze</span>
                          </label>
                          <input 
                            type="text" 
                            required
                            placeholder="e.g., MPSD/ADM/2026/012 (Or run AI Classifier)"
                            className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-2 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                            value={refNo}
                            onChange={(e) => setRefNo(e.target.value)}
                          />
                        </div>

                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        
                        {/* Direction Flow */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-700 uppercase">Correspondence Flow</label>
                          <select 
                            className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5"
                            value={docDirection}
                            onChange={(e) => setDocDirection(e.target.value as DocDirection)}
                          >
                            <option value="incoming">Incoming Hand-off</option>
                            <option value="outgoing">Outgoing Dispatch</option>
                          </select>
                        </div>

                        {/* Doc Type */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-700 uppercase">Document Category</label>
                          <select 
                            className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5"
                            value={docType}
                            onChange={(e) => setDocType(e.target.value as DocType)}
                          >
                            <option value="letter">Letter</option>
                            <option value="file">Case Folder</option>
                            <option value="report">Executive Report</option>
                          </select>
                        </div>

                        {/* Security */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-700 uppercase">Security Classification</label>
                          <select 
                            className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 font-mono text-xs"
                            value={securityClassification}
                            onChange={(e) => setSecurityClassification(e.target.value as SecurityClassification)}
                          >
                            <option value="open">Open / Public</option>
                            <option value="restricted">Restricted Policies</option>
                            <option value="confidential">Confidential</option>
                            <option value="secret">Secret Vault Only</option>
                          </select>
                        </div>

                        {/* Priority */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-700 uppercase">Routing SLA Speed</label>
                          <select 
                            className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5"
                            value={priority}
                            onChange={(e) => setPriority(e.target.value as Priority)}
                          >
                            <option value="low">Standard Check</option>
                            <option value="medium">Medium Processing</option>
                            <option value="high">Priority Clearance</option>
                            <option value="immediate">Immediate Dispatch</option>
                          </select>
                        </div>

                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        
                        {/* Sender */}
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Sender Entity / Name</label>
                          <input 
                            type="text" 
                            placeholder="e.g., Permanent Secretary, Lands Office"
                            className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-2 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                            value={senderName}
                            onChange={(e) => setSenderName(e.target.value)}
                          />
                        </div>

                        {/* Recipient */}
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Designated Consignee / Department</label>
                          <input 
                            type="text" 
                            placeholder="e.g., Junior Surveyor, Central Survey Team"
                            className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-2 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                            value={recipientName}
                            onChange={(e) => setRecipientName(e.target.value)}
                          />
                        </div>

                      </div>

                      {/* Summary Abstract / Subject */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center justify-between">
                          <span>Official Registry Abstract (Subject Summary)</span>
                          <span className="text-[10px] text-slate-400">Visible on standard public registers</span>
                        </label>
                        <textarea 
                          rows={2}
                          placeholder="Provide a formal description or summary of issues. Auto-fills with AI guide processing."
                          className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-2 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition leading-relaxed"
                          value={subject}
                          onChange={(e) => setSubject(e.target.value)}
                        />
                      </div>

                      {/* Core Body text for OCR simulation / parser input */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center justify-between">
                          <span>Raw Draft Copy / OCR File Contents Buffer</span>
                          <span className="text-[10px] text-slate-400">Required for AI classification pipeline</span>
                        </label>
                        <textarea 
                          rows={4}
                          placeholder="Paste correspondence paragraphs, scan readouts, or memo letters here..."
                          className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-2 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition font-mono whitespace-pre-wrap leading-relaxed"
                          value={bodyText}
                          onChange={(e) => setBodyText(e.target.value)}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        
                        {/* Custom tags */}
                        <div className="space-y-1 md:col-span-2">
                          <label className="text-[11px] font-bold text-slate-700 uppercase">Archive Discovery Tags (Comma separated)</label>
                          <input 
                            type="text" 
                            placeholder="e.g., SurveyClaim, BorderDispute, CabinetDirective"
                            className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                            value={tagsInput}
                            onChange={(e) => setTagsInput(e.target.value)}
                          />
                        </div>

                        {/* Designation desk */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-700 uppercase">Assigned Custody Location / Handler</label>
                          <input 
                            type="text" 
                            placeholder="e.g., Nakato (Archives Room 4)"
                            className="w-full bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                            value={currentLocation}
                            onChange={(e) => {
                              setCurrentLocation(e.target.value);
                              setCurrentHandler(e.target.value.split(" ")[0] || "Nakato");
                            }}
                          />
                        </div>

                      </div>

                      {/* Submission buttons */}
                      <div className="pt-2 flex justify-end gap-3 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm("Abandon current filing wizard? All uncommitted edits will slide off registry tables.")) {
                              setActiveTab("registry");
                            }
                          }}
                          className="px-4 py-2 bg-slate-50 text-slate-600 rounded text-xs hover:bg-slate-100 hover:text-slate-800 transition font-mono cursor-pointer"
                        >
                          Cancel Filing
                        </button>

                        <button
                          type="submit"
                          className="px-6 py-2 bg-emerald-600 text-white font-bold rounded text-xs hover:bg-emerald-700 shadow flex items-center gap-1.5 cursor-pointer transition active:scale-95"
                        >
                          <FileCheck className="w-4 h-4 text-emerald-200" />
                          <span>Commit & Issue Registry Dossier</span>
                        </button>
                      </div>

                    </form>
                  </div>

                </div>

              </div>
            )}


            {/* ==========================================
                VIEW 4: LIVE MOVEMENTS TRACKING
                ========================================== */}
            {activeTab === "tracking" && (
              <div className="space-y-6">
                
                {/* Movement Ledger Card */}
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                  <div className="bg-slate-50 border-b border-slate-200 px-4 py-3.5 flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest font-mono">
                        National Registry File Movement & Transit Grid
                      </h3>
                      <p className="text-xs text-slate-500">
                        A real-time tracking mechanism logging physical courier locations to eliminate folder misplacement.
                      </p>
                    </div>

                    <span className="bg-[#1e293b] text-emerald-400 font-mono text-xs px-2.5 py-0.5 rounded border border-slate-800">
                      SLA: 24-Hours Handback
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-700 divide-y divide-slate-200">
                      <thead className="bg-[#0f172a] text-white font-mono text-[10px] uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-3">Tracking Ref No</th>
                          <th className="px-4 py-3">Document Title</th>
                          <th className="px-4 py-3">Sender Station (Origin)</th>
                          <th className="px-4 py-3">Recipient Station (Target)</th>
                          <th className="px-4 py-3">Dispatch Timestamp</th>
                          <th className="px-4 py-3">SLA Transit Status</th>
                          <th className="px-4 py-3 text-right">Receipt Hand-off</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {movements.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="text-center py-12 text-slate-400">
                              <MapPin className="w-8 h-8 text-slate-350 mx-auto" />
                              <p className="mt-2 text-xs font-bold text-slate-800 uppercase font-mono">No Transits Logged</p>
                              <p className="text-[11px] text-slate-500">Dispatch physical folders via the Digital Register to open barcode transit trails.</p>
                            </td>
                          </tr>
                        ) : (
                          movements.map((mov) => {
                            const isPending = !mov.receiveTime;
                            const isOverdue = false;
                            return (
                              <tr key={mov.id} className="hover:bg-slate-50/70">
                                <td className="px-4 py-3.5 space-y-1">
                                  <div className="font-mono text-slate-900 font-bold tracking-tight">{mov.refNo}</div>
                                  <div className="text-[9px] text-slate-400 font-mono">Voucher ID: {mov.id}</div>
                                </td>

                                <td className="px-4 py-3.5 max-w-xs">
                                  <div className="font-semibold text-slate-800 line-clamp-1">{mov.title}</div>
                                  <p className="text-[10px] text-slate-500 truncate italic">Purpose: {mov.purpose}</p>
                                </td>

                                <td className="px-4 py-3.5">
                                  <div className="font-medium text-slate-800">{mov.fromOfficer}</div>
                                  <div className="text-[10px] text-slate-500">{mov.fromLocation}</div>
                                </td>

                                <td className="px-4 py-3.5">
                                  <div className="font-semibold text-slate-800">{mov.toOfficer}</div>
                                  <div className="text-[10px] text-slate-500">{mov.toLocation}</div>
                                </td>

                                <td className="px-4 py-3.5 font-mono text-slate-700">
                                  {new Date(mov.dispatchTime).toLocaleString()}
                                </td>

                                <td className="px-4 py-3.5 select-none">
                                  {isPending ? (
                                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                                      isOverdue 
                                        ? "bg-red-100 text-red-700 border border-red-200 delicate-pulse"
                                        : "bg-amber-100 text-[#b45309] border border-amber-250"
                                    }`}>
                                      <Clock className="w-2.5 h-2.5" />
                                      {isOverdue ? "Overdue SLA" : "In Transit"}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-250 rounded">
                                      <Check className="w-2.5 h-2.5" />
                                      Safely Checked-In
                                    </span>
                                  )}
                                </td>

                                <td className="px-4 py-3.5 text-right">
                                  {isPending ? (
                                    <button
                                      onClick={() => setShowReceiveModal(mov)}
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-2.5 py-1.5 rounded flex items-center gap-1 ml-auto cursor-pointer transition"
                                    >
                                      <Fingerprint className="w-3.5 h-3.5 text-emerald-200" />
                                      <span>Check In</span>
                                    </button>
                                  ) : (
                                    <div className="space-y-0.5 select-none text-right">
                                      <span className="text-[10px] font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 border rounded">
                                        Sig: {mov.receiverSignature || "Verified"}
                                      </span>
                                      <div className="text-[9px] text-slate-400 font-mono">
                                        {new Date(mov.receiveTime!).toLocaleTimeString()}
                                      </div>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}


            {/* ==========================================
                VIEW 5: THE BORROWING REQUISITIONS CONTROL
                ========================================== */}
            {activeTab === "requisitions" && (
              <div className="space-y-6">
                
                {/* Requisition Table List */}
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                  <div className="bg-slate-50 border-b border-slate-200 px-4 py-3.5 flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest font-mono">
                        National Records Archive Custody Requisitions
                      </h3>
                      <p className="text-xs text-slate-500">
                        Register of external file borrowing requests requiring central archivist clearance to restrict dossier losses.
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setReqDocId(documents[0]?.id || "");
                        setShowReqModal(true);
                      }}
                      className="bg-[#0f172a] hover:bg-slate-800 text-white font-bold text-xs px-3.5 py-2 rounded flex items-center gap-1.5 cursor-pointer transition"
                    >
                      <Plus className="w-4 h-4 text-emerald-400" />
                      <span>Issue Search Borrow Slip</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-700 divide-y divide-slate-200">
                      <thead className="bg-[#1e293b] text-white font-mono text-[10px] uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-3">Filing reference</th>
                          <th className="px-4 py-3">Borrower / Department</th>
                          <th className="px-4 py-3">Filing Description</th>
                          <th className="px-4 py-3">Request Period</th>
                          <th className="px-4 py-3">Dossier Medium</th>
                          <th className="px-4 py-3">Custody State</th>
                          <th className="px-4 py-3 text-right">Archivist Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {requisitions.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="text-center py-12 text-slate-400">
                              <Fingerprint className="w-8 h-8 text-slate-300 mx-auto" />
                              <p className="mt-2 text-xs font-bold text-slate-800 uppercase font-mono">No Active Borrow Slips</p>
                              <p className="text-[11px] text-slate-500">Create a borrowing search slip to temporarily route archives custody.</p>
                            </td>
                          </tr>
                        ) : (
                          requisitions.map((req) => {
                            return (
                              <tr key={req.id} className="hover:bg-slate-50/70">
                                <td className="px-4 py-3.5">
                                  <div className="font-mono text-slate-900 font-bold tracking-tight">{req.docRefNo}</div>
                                  <div className="text-[9px] text-slate-400 font-mono">Slip: {req.id}</div>
                                </td>

                                <td className="px-4 py-3.5">
                                  <div className="font-semibold text-slate-800">{req.requestorName}</div>
                                  <p className="text-[10px] text-slate-500 font-mono italic">{req.requestorEmail}</p>
                                  <p className="text-[10px] text-slate-500 font-bold">{req.department}</p>
                                </td>

                                <td className="px-4 py-3.5 max-w-xs">
                                  <div className="font-semibold text-slate-800 line-clamp-1">{req.docTitle}</div>
                                  <p className="text-[10px] text-slate-500 line-clamp-1">Purpose: {req.purpose}</p>
                                </td>

                                <td className="px-4 py-3.5 space-y-0.5">
                                  <span className="text-[10px] text-slate-500">Requested: {new Date(req.requestDate).toLocaleDateString()}</span>
                                  <div className="text-[10px] font-bold text-red-650">Hold until: {req.neededUntil}</div>
                                </td>

                                <td className="px-4 py-3.5">
                                  <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded border ${
                                    req.isPhysical 
                                      ? "bg-amber-100 border-amber-250 text-amber-700 font-bold"
                                      : "bg-blue-100 border-blue-250 text-blue-700 font-bold"
                                  }`}>
                                    {req.isPhysical ? "Physical Folder" : "Digital PDF Copy"}
                                  </span>
                                </td>

                                <td className="px-4 py-3.5">
                                  <span className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                                    req.status === "pending"
                                      ? "bg-amber-100 text-amber-700 animate-pulse border border-amber-200"
                                      : req.status === "approved"
                                      ? "bg-blue-100 text-blue-700 border border-blue-250"
                                      : req.status === "issued"
                                      ? "bg-red-50 text-red-600 border border-red-200"
                                      : req.status === "returned"
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-250"
                                      : "bg-slate-150 text-slate-500 border"
                                  }`}>
                                    {req.status}
                                  </span>
                                </td>

                                <td className="px-4 py-3.5 text-right space-y-1.5">
                                  {req.status === "pending" && (
                                    <div className="flex gap-1.5 justify-end">
                                      <button
                                        onClick={() => handleRequisitionWorkflow(req.id, "approved")}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-2.5 py-1 rounded cursor-pointer transition uppercase tracking-wider"
                                      >
                                        Approve
                                      </button>
                                      <button
                                        onClick={() => handleRequisitionWorkflow(req.id, "rejected")}
                                        className="bg-red-100 hover:bg-red-200 text-red-700 font-bold text-[10px] px-2.5 py-1 rounded cursor-pointer transition uppercase tracking-wider"
                                      >
                                        Deny
                                      </button>
                                    </div>
                                  )}

                                  {req.status === "approved" && (
                                    <button
                                      onClick={() => handleRequisitionWorkflow(req.id, "issued")}
                                      className="bg-[#d97706] hover:bg-[#b56505] text-white font-bold text-[10px] px-3.5 py-1 rounded ml-auto flex items-center gap-1 cursor-pointer transition uppercase tracking-wider"
                                    >
                                      <FileClock className="w-3.5 h-3.5 text-amber-100" />
                                      <span>Issue Physical Document</span>
                                    </button>
                                  )}

                                  {req.status === "issued" && (
                                    <button
                                      onClick={() => handleRequisitionWorkflow(req.id, "returned")}
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-3.5 py-1 rounded ml-auto flex items-center gap-1 cursor-pointer transition uppercase tracking-wider shadow"
                                    >
                                      <FileCheck className="w-3.5 h-3.5 text-emerald-200 animate-pulse" />
                                      <span>Receive & Return Shelf</span>
                                    </button>
                                  )}

                                  {req.status === "returned" && (
                                    <span className="text-[10px] text-slate-400 font-mono font-bold uppercase tracking-wider block">
                                      Vault Checked IN
                                    </span>
                                  )}

                                  {req.status === "rejected" && (
                                    <span className="text-[10px] text-red-400 font-mono font-bold uppercase tracking-wider block">
                                      Rejected Request
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}


            {/* ==========================================
                VIEW 6: SYSTEM AUDITS LOG (LEDGER TRAIL)
                ========================================== */}
            {activeTab === "audit" && (
              <div className="space-y-6">
                
                {/* Audit Grid */}
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 shadow-2l space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-3">
                    <div className="space-y-0.5">
                      <h3 className="text-sm font-bold text-white uppercase tracking-widest font-mono">
                        Permanent Digital Compliance Registry Ledger Audit
                      </h3>
                      <p className="text-xs text-slate-400">
                        Secure non-repudiation logging. Every inward register, OCR metadata analyze, and physical checkout is locked Retroactively.
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded border border-slate-800">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest font-mono select-none">SHA-256 Checksum:</span>
                      <span className="font-mono text-emerald-400 text-xs">A908F...90C2A</span>
                    </div>
                  </div>

                  <div className="space-y-3 font-mono text-[11px] max-h-[500px] overflow-y-auto pr-2">
                    {logs.map((log) => {
                      const isAlert = log.severity === "alert";
                      const isWarn = log.severity === "warning";
                      return (
                        <div 
                          key={log.id} 
                          className={`p-3 rounded border transition flex flex-col md:flex-row gap-3 md:items-start ${
                            isAlert 
                              ? 'bg-red-950/20 border-red-900/60 text-red-200' 
                              : isWarn 
                              ? 'bg-amber-950/20 border-amber-900/60 text-amber-200'
                              : 'bg-slate-950/40 border-slate-800 text-slate-300'
                          }`}
                        >
                          <span className="text-slate-500 shrink-0 uppercase tracking-wider select-none font-bold">
                            {new Date(log.timestamp).toLocaleString()}
                          </span>

                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <span className={`font-bold select-none px-1.5 rounded text-[10px] uppercase tracking-wide ${
                                isAlert ? 'bg-red-900/40 text-red-300 border border-red-800' : isWarn ? 'bg-amber-900/40 text-amber-300' : 'bg-slate-800 text-slate-400'
                              }`}>
                                {log.action}
                              </span>
                              <span className="text-[10px] text-slate-500">By: {log.userName} ({log.userEmail})</span>
                            </div>
                            <p className="leading-relaxed leading-5">{log.details}</p>
                          </div>

                          {log.refId && (
                            <span className="bg-slate-900 text-slate-400 border border-slate-800 px-2 py-0.5 rounded text-[10px] shrink-0 self-start md:self-auto uppercase tracking-wider">
                              Ref: {log.refId.slice(0, 8)}
                            </span>
                          )}

                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            )}

          </div>
        )}

      </main>

      {/* ==========================================
          MODAL 1: PHYSICAL COURIER DISPATCH FORM
          ========================================== */}
      {showDispatchModal && selectedDoc && (
        <div className="fixed inset-0 bg-slate-950/45 flex items-center justify-center p-4 z-50 backdrop-blur-xs select-none">
          <div className="bg-white border-2 border-slate-350 rounded-lg shadow-2xl max-w-lg w-full overflow-hidden animate-zoomIn">
            <div className="bg-[#1e293b] text-white px-4 py-3 border-b flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase tracking-widest font-mono text-emerald-400 flex items-center gap-1.5">
                <Send className="w-4 h-4 text-emerald-400" />
                <span>Issue Dispatch Tracking Slip</span>
              </h3>
              <button 
                onClick={() => setShowDispatchModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDispatchSubmit} className="p-4 space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs space-y-1">
                <div className="font-mono text-[10px] font-bold text-slate-400 uppercase">Document selected:</div>
                <div className="font-semibold text-slate-900 text-sm line-clamp-1">{selectedDoc.title}</div>
                <div className="font-mono text-emerald-700 font-bold">{selectedDoc.refNo}</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Recipient Department</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Office of Permanent Secretary"
                    className="w-full bg-slate-50 border border-slate-200 rounded text-xs p-2 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition font-medium text-slate-900"
                    value={transitToLocation}
                    onChange={(e) => setTransitToLocation(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Recipient Officer Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Secretary Arthur"
                    className="w-full bg-slate-50 border border-slate-200 rounded text-xs p-2 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition font-medium text-slate-900"
                    value={transitToOfficer}
                    onChange={(e) => setTransitToOfficer(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Dispatch Purpose</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Executive signature and final review"
                  className="w-full bg-slate-50 border border-slate-200 rounded text-xs p-2 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition text-semibold"
                  value={transitPurpose}
                  onChange={(e) => setTransitPurpose(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Transit Remarks (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Additional courier remarks, e.g., Handle with absolute secrecy."
                  className="w-full bg-slate-50 border border-slate-200 rounded text-xs p-2 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition text-slate-700"
                  value={transitRemarks}
                  onChange={(e) => setTransitRemarks(e.target.value)}
                />
              </div>

              {/* Barcode tracking reminder */}
              <div className="p-3 bg-amber-50 rounded border border-amber-200 text-amber-800 text-[10px] leading-relaxed flex items-start gap-2 select-none">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block uppercase tracking-wide">IMPORTANT PHYSICAL CHECKOUT REQUIREMENT</span>
                  Once committed, this document status locks in-transit. A digital barcode is attached. To safely unlock, the recipient officer must draw or type their name to sign-off receipt.
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDispatchModal(false)}
                  className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded text-xs transition font-mono cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 text-white font-bold rounded text-xs hover:bg-emerald-700 cursor-pointer shadow-md flex items-center gap-1 transition"
                >
                  <Send className="w-3.5 h-3.5 text-emerald-200" />
                  <span>Commit Dispatch Courier</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* ==========================================
          MODAL 2: INTERACTIVE HAND-OFF RECEIPT (SIGNATURE)
          ========================================== */}
      {showReceiveModal && (
        <div className="fixed inset-0 bg-slate-950/45 flex items-center justify-center p-4 z-50 backdrop-blur-xs">
          <div className="bg-white border-2 border-slate-350 rounded-lg shadow-2xl max-w-lg w-full overflow-hidden animate-zoomIn">
            <div className="bg-[#0f172a] text-white px-4 py-3 border-b flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase tracking-widest font-mono text-emerald-400 flex items-center gap-1.5">
                <Fingerprint className="w-4 h-4 text-emerald-400" />
                <span>Electronic Receipt Hand-Off Acknowledge</span>
              </h3>
              <button 
                onClick={() => {
                  setShowReceiveModal(null);
                  clearSignatureCanvas();
                }}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              
              <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs space-y-1 leading-relaxed">
                <div className="font-mono text-[9px] font-bold text-slate-400 uppercase">TRANSIT DOSSIER ID & SUMMARY:</div>
                <div className="font-mono font-bold text-slate-900">{showReceiveModal.refNo}</div>
                <div className="font-semibold text-slate-850 line-clamp-1">{showReceiveModal.title}</div>
                <div className="text-[10px] text-slate-500 font-medium">To Officer: <span className="font-bold">{showReceiveModal.toOfficer} ({showReceiveModal.toLocation})</span></div>
              </div>

              {/* Hand signature interaction selector */}
              <div className="space-y-2 select-none">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Signature Method Validation</label>
                  <div className="flex gap-1 bg-slate-100 p-0.5 rounded border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setSignType("type")}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer ${
                        signType === "type" ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Type Name
                    </button>
                    <button
                      type="button"
                      onClick={() => setSignType("draw")}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer ${
                        signType === "draw" ? "bg-white text-slate-800 shadow-xs" : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Interactive Drawing Pad
                    </button>
                  </div>
                </div>

                {signType === "type" ? (
                  <div className="space-y-1 animate-fadeIn">
                    <input
                      type="text"
                      placeholder="Type your official name to sign..."
                      className="w-full bg-slate-50 border border-slate-200 rounded text-xs p-2.5 font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                      value={typedSignature}
                      onChange={(e) => setTypedSignature(e.target.value)}
                    />
                    <p className="text-[9px] text-slate-400">By typing your name, you acknowledge direct legal custody of the contents under state law.</p>
                  </div>
                ) : (
                  <div className="space-y-1.5 animate-fadeIn">
                    <div className="border border-slate-300 rounded overflow-hidden bg-slate-50 relative h-32 cursor-crosshair">
                      <canvas
                        ref={canvasRef}
                        width={460}
                        height={128}
                        onMouseDown={startDrawing}
                        onMouseMove={drawSignature}
                        onMouseUp={() => setIsDrawing(false)}
                        onMouseLeave={() => setIsDrawing(false)}
                        className="w-full h-full block"
                      />
                      <button
                        type="button"
                        onClick={clearSignatureCanvas}
                        className="absolute right-2 bottom-2 text-[9px] font-bold bg-white hover:bg-slate-150 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200"
                      >
                        Reset Canvas
                      </button>
                    </div>
                    <p className="text-[9px] text-slate-400">Click and drag inside the pad with your trackpad or mouse cursor to establish an electronic touch signature.</p>
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowReceiveModal(null);
                    clearSignatureCanvas();
                  }}
                  className="px-4 py-2 bg-slate-50 text-slate-600 rounded text-xs transition font-mono cursor-pointer"
                >
                  Cancel Check-In
                </button>
                <button
                  type="button"
                  onClick={() => handleAcknowledgeReceive(showReceiveModal.id)}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded text-xs flex items-center gap-1 transition shadow cursor-pointer active:scale-95"
                >
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-200" />
                  <span>Acknowledge Physical Receipt</span>
                </button>
              </div>

            </div>
          </div>
        </div>
      )}


      {/* ==========================================
          MODAL 3: ISSUE A BORROW SLIP REQUISITION
          ========================================== */}
      {showReqModal && (
        <div className="fixed inset-0 bg-slate-950/45 flex items-center justify-center p-4 z-50 backdrop-blur-xs select-none">
          <div className="bg-white border-2 border-slate-350 rounded-lg shadow-2xl max-w-lg w-full overflow-hidden animate-zoomIn">
            <div className="bg-[#1e293b] text-white px-4 py-3 border-b flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase tracking-widest font-mono text-emerald-400 flex items-center gap-1.5">
                <Fingerprint className="w-4 h-4 text-amber-500" />
                <span>Issue Archival Slip Borrowing Slip</span>
              </h3>
              <button 
                onClick={() => setShowReqModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBorrowRequestSubmit} className="p-4 space-y-4">
              
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Dossier File / Document to Requisition</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-200 rounded text-xs p-2 focus:bg-white text-slate-900 font-semibold"
                  value={reqDocId}
                  onChange={(e) => setReqDocId(e.target.value)}
                >
                  {documents.map((d) => (
                    <option key={d.id} value={d.id}>
                      [{d.refNo}] - {d.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Requestor Officer Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Principal HR Officer Musoke"
                    className="w-full bg-slate-50 border border-slate-200 rounded text-xs p-2 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition font-medium text-slate-950"
                    value={reqRequestor}
                    onChange={(e) => setReqRequestor(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Official Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g., musoke@publicservice.go.ug"
                    className="w-full bg-slate-50 border border-slate-200 rounded text-xs p-2 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition font-mono text-medium text-slate-950"
                    value={reqEmail}
                    onChange={(e) => setReqEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Requestor Department</label>
                  <input
                    type="text"
                    placeholder="e.g., Human Resource Division"
                    className="w-full bg-slate-50 border border-slate-200 rounded text-xs p-2"
                    value={reqDept}
                    onChange={(e) => setReqDept(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Expected Custody Period Limit</label>
                  <input
                    type="date"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded text-xs p-2 font-mono"
                    value={reqDuration}
                    onChange={(e) => setReqDuration(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5 font-medium">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide block">Filing Medium Requirements</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                    <input 
                      type="radio" 
                      name="borrowType"
                      checked={reqPhysical}
                      onChange={() => setReqPhysical(true)}
                    />
                    <span>Retrieve Physical Folder Box</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                    <input 
                      type="radio" 
                      name="borrowType"
                      checked={!reqPhysical}
                      onChange={() => setReqPhysical(false)}
                    />
                    <span>Digitised Electronic Download (PDF Copy)</span>
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Clearance Statement / Borrow Purpose</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Justification statements are audited. Mention specific policy headings."
                  className="w-full bg-slate-50 border border-slate-200 rounded text-xs p-2 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition"
                  value={reqPurpose}
                  onChange={(e) => setReqPurpose(e.target.value)}
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowReqModal(false)}
                  className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded text-xs transition font-mono cursor-pointer"
                >
                  Cancel Borrow Slip
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 text-slate-950 font-bold rounded text-xs hover:bg-amber-500 cursor-pointer shadow flex items-center gap-1 transition"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Transmit Borrow Request</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* 3. NATIONAL DIGITAL FOOTER */}
      <footer className="bg-slate-900 text-slate-400 text-xs border-t border-slate-800 py-6 mt-12 bg-gradient-to-t from-slate-950 to-slate-900 select-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-2 leading-relaxed">
          <div className="flex items-center justify-center gap-2">
            <span className="h-0.5 w-10 bg-slate-800"></span>
            <div className="text-emerald-500 font-mono font-bold tracking-widest text-[10px] uppercase flex items-center gap-1">
              <Database className="w-3 h-3" /> Data Management Directorate
            </div>
            <span className="h-0.5 w-10 bg-slate-800"></span>
          </div>
          <p className="max-w-2xl mx-auto text-slate-500 text-[11px]">
            This system complies strictly with standard government protocols. Security levels configurations and transactional routing check-ins are cataloged onto high-fidelity vaults to eliminate civil resource misplacements.
          </p>
          <div className="text-[10px] font-mono text-slate-600">
            Current Session Timestamp: {new Date().toISOString()} • Host Platform Version 2.2-Alpha
          </div>
        </div>
      </footer>

    </div>
  );
}

// Visual Barcode Helper
function BarcodeText({ text, classPrefix = "h-4" }: { text: string; classPrefix?: string }) {
  // Simple deterministic generation of pseudo-bar lines based on character codes
  const lines = [];
  const cleanStr = String(text || "LEDI-9331-BAR").trim();
  for (let i = 0; i < Math.min(cleanStr.length, 16); i++) {
    const code = cleanStr.charCodeAt(i);
    // Draw thick/thin margins representation
    const widthClass = code % 3 === 0 ? "w-1" : code % 2 === 0 ? "w-[2px]" : "w-[0.5px]";
    const opacityClass = code % 4 === 0 ? "bg-slate-700" : "bg-slate-900";
    lines.push(
      <div key={i} className={`h-full ${widthClass} ${opacityClass} inline-block`} style={{ marginRight: '1px' }} />
    );
  }
  return (
    <div className="space-y-1 py-1 px-1 flex flex-col items-center">
      <div className={`${classPrefix} flex items-center justify-center overflow-hidden`}>
        {lines}
      </div>
      <div className="font-mono text-[9px] tracking-widest uppercase font-bold text-slate-755">{cleanStr}</div>
    </div>
  );
}
