import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from backend.models.models import ExamSession, Violation, Answer, Report, User
from backend.config import Config

def generate_pdf_report(session_id):
    """
    Generates a professional PDF proctoring report for an exam session.
    Saves the PDF inside uploads/reports/ and returns the relative path.
    """
    # Fetch data
    session = ExamSession.get_session_details(session_id)
    if not session:
        raise ValueError(f"Exam session ID {session_id} not found.")

    violations = Violation.get_by_session(session_id)
    scored, total = Answer.calculate_score(session_id)
    
    # Setup directories
    reports_dir = os.path.join(Config.UPLOAD_FOLDER, 'reports')
    os.makedirs(reports_dir, exist_ok=True)
    
    pdf_filename = f"report_session_{session_id}.pdf"
    pdf_path = os.path.join(reports_dir, pdf_filename)
    
    # Doc template setup
    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=letter,
        rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40
    )
    
    styles = getSampleStyleSheet()
    
    # Define custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=24,
        textColor=colors.HexColor('#0F172A'), # Slate 900
        spaceAfter=15
    )
    
    section_heading = ParagraphStyle(
        'SectionHeading',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=14,
        textColor=colors.HexColor('#1E293B'), # Slate 800
        spaceBefore=15,
        spaceAfter=10
    )
    
    body_style = ParagraphStyle(
        'BodyTextCustom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        textColor=colors.HexColor('#475569'), # Slate 600
        leading=14
    )
    
    label_style = ParagraphStyle(
        'LabelText',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        textColor=colors.HexColor('#1E293B'),
    )

    story = []
    
    # Header Banner (Visual Decoration)
    story.append(Paragraph("AI-BASED PROCTORING ASSESSMENT REPORT", title_style))
    story.append(Paragraph(f"Generated automatically for Exam Session #{session_id}", body_style))
    story.append(Spacer(1, 15))
    
    # Student and Exam Metadata Block (Grid layout)
    meta_data = [
        [
            Paragraph("Student Name:", label_style), 
            Paragraph(str(session['student_name']), body_style),
            Paragraph("Exam Title:", label_style), 
            Paragraph(str(session['exam_title']), body_style)
        ],
        [
            Paragraph("Student Email:", label_style), 
            Paragraph(str(session['student_email']), body_style),
            Paragraph("Duration Allocated:", label_style), 
            Paragraph(f"{session['duration_minutes']} minutes", body_style)
        ],
        [
            Paragraph("Started At:", label_style), 
            Paragraph(str(session['started_at']), body_style),
            Paragraph("Completed At:", label_style), 
            Paragraph(str(session['completed_at'] or 'Active/Terminated'), body_style)
        ],
        [
            Paragraph("Exam Grade Score:", label_style), 
            Paragraph(f"{scored} / {total} points", body_style),
            Paragraph("Status:", label_style), 
            Paragraph(str(session['status']).upper(), body_style)
        ]
    ]
    
    meta_table = Table(meta_data, colWidths=[1.5*inch, 2.0*inch, 1.5*inch, 2.0*inch])
    meta_table.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('LINEBELOW', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
    ]))
    
    story.append(meta_table)
    story.append(Spacer(1, 20))
    
    # AI Proctoring Integrity Metrics
    cheating_score = session['cheating_score'] or 0
    warning_count = session['warning_count'] or 0
    
    # Determine color index
    if cheating_score < 30:
        score_color = '#10B981' # Green
        integrity_status = "INTEGRITY SECURE"
    elif cheating_score < 70:
        score_color = '#F59E0B' # Orange/Yellow
        integrity_status = "MODERATE RISK"
    else:
        score_color = '#EF4444' # Red
        integrity_status = "HIGH SUSPICION - CRITICAL"

    metric_data = [
        [
            Paragraph("Proctoring Integrity Summary", label_style), 
            ""
        ],
        [
            Paragraph("Overall Cheating Score:", body_style),
            Paragraph(f"<font color='{score_color}'><b>{cheating_score} / 100 ({integrity_status})</b></font>", body_style)
        ],
        [
            Paragraph("Warnings Triggered:", body_style),
            Paragraph(f"<b>{warning_count} / 5 warnings</b>", body_style)
        ]
    ]
    
    metric_table = Table(metric_data, colWidths=[2.5*inch, 4.5*inch])
    metric_table.setStyle(TableStyle([
        ('SPAN', (0, 0), (1, 0)),
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#F8FAFC')),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
    ]))
    
    story.append(metric_table)
    story.append(Spacer(1, 20))
    
    # Violations Details List
    story.append(Paragraph("Detailed Infractions Log", section_heading))
    
    if len(violations) == 0:
        story.append(Paragraph("No academic integrity violations were detected during this session. Candidate maintained professional exam environment.", body_style))
    else:
        violation_rows = [[
            Paragraph("<b>Timestamp</b>", label_style),
            Paragraph("<b>Violation Type</b>", label_style),
            Paragraph("<b>Confidence</b>", label_style)
        ]]
        
        for v in violations:
            violation_rows.append([
                Paragraph(str(v['timestamp']), body_style),
                Paragraph(str(v['violation_type']), body_style),
                Paragraph(f"{float(v['confidence_score'] or 1.0) * 100:.0f}%", body_style)
            ])
            
        violation_table = Table(violation_rows, colWidths=[2.2*inch, 3.8*inch, 1.0*inch])
        violation_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#F1F5F9')),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
            ('TOPPADDING', (0,0), (-1,-1), 6),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ]))
        story.append(violation_table)
        
    story.append(Spacer(1, 20))
    
    # Screenshots Appendix (Visual Evidence)
    screenshot_violations = [v for v in violations if v['screenshot_path']]
    
    if len(screenshot_violations) > 0:
        story.append(Paragraph("Appendix: Cheating Evidence Screenshots", section_heading))
        story.append(Paragraph("The following screenshots were automatically captured by the AI engine when high-suspicion actions were triggered.", body_style))
        story.append(Spacer(1, 10))
        
        images_story = []
        for index, sv in enumerate(screenshot_violations):
            rel_path = sv['screenshot_path']
            # Convert to absolute path
            # If path is stored as relative, we resolve relative to UPLOAD_FOLDER or PROJECT_ROOT
            if os.path.isabs(rel_path):
                abs_path = rel_path
            else:
                abs_path = os.path.join(Config.BASE_DIR, rel_path)
                
            if os.path.exists(abs_path):
                try:
                    # Load and scale image to fit page width (roughly 5 inches width)
                    img = Image(abs_path, width=4.5*inch, height=2.8*inch)
                    caption = Paragraph(f"<b>Evidence Image #{index+1}</b>: {sv['violation_type']} detected at {sv['timestamp']}", body_style)
                    
                    # Group image and caption together so they don't break across pages
                    images_story.append(KeepTogether([img, Spacer(1, 5), caption, Spacer(1, 15)]))
                except Exception as img_err:
                    print(f"[REPORT ERROR] Could not embed screenshot: {abs_path}. Error: {img_err}")
            else:
                print(f"[REPORT ERROR] Screenshot file not found: {abs_path}")
                
        if images_story:
            story.extend(images_story)
            
    # Build Document
    doc.build(story)
    
    # Save Report record in DB
    relative_report_path = os.path.join('uploads', 'reports', pdf_filename).replace('\\', '/')
    Report.create(session_id, relative_report_path)
    
    return relative_report_path
