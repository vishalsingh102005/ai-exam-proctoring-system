import sys
import os

# Append parent directory to sys.path so we can import from backend
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.database.db import db
from backend.utils.security import hash_password
from backend.models.models import User, Exam, Question, AuditLog

def seed_database():
    print("[SEEDER] Checking existing records...")
    
    # 1. Check if users already exist
    existing_admin = db.fetch_one("SELECT * FROM users WHERE email = %s", ("admin@college.edu",))
    
    if not existing_admin:
        admin_pass = hash_password("adminpassword")
        admin_id = User.create("System Administrator", "admin@college.edu", admin_pass, "admin")
        print(f"[SEEDER] Created Admin: admin@college.edu (ID: {admin_id})")
        AuditLog.log(admin_id, 'DATABASE_SEEDED', "Created system admin via seeder")
    else:
        print("[SEEDER] Admin user already exists.")

    existing_student = db.fetch_one("SELECT * FROM users WHERE email = %s", ("student@college.edu",))
    if not existing_student:
        student_pass = hash_password("studentpassword")
        student_id = User.create("Vishal Singh", "student@college.edu", student_pass, "student")
        print(f"[SEEDER] Created Student: student@college.edu (ID: {student_id})")
        AuditLog.log(student_id, 'DATABASE_SEEDED', "Created default student via seeder")
    else:
        print("[SEEDER] Student user already exists.")

    # 2. Check if exams already exist
    existing_exams = db.fetch_all("SELECT * FROM exams")
    if len(existing_exams) == 0:
        exam_id = Exam.create(
            "Introduction to Artificial Intelligence",
            "This examination assesses core concepts of Machine Learning, Neural Networks, Computer Vision, and AI Ethics.",
            30, # 30 minutes
            5,  # 5 questions
            40, # passing score
            1   # active
        )
        print(f"[SEEDER] Created Exam: Introduction to Artificial Intelligence (ID: {exam_id})")
        
        # Add Questions
        questions = [
            {
                "text": "What does CNN stand for in Deep Learning?",
                "a": "Computer Network Node",
                "b": "Convolutional Neural Network",
                "c": "Core Neural Network",
                "d": "Cognitive Neural Net",
                "correct": "B"
            },
            {
                "text": "Which of the following is a supervised learning algorithm?",
                "a": "K-Means Clustering",
                "b": "Linear Regression",
                "c": "Principal Component Analysis (PCA)",
                "d": "Apriori Association Rule",
                "correct": "B"
            },
            {
                "text": "In computer vision, what is YOLO primarily used for?",
                "a": "Image Compression",
                "b": "Text Summarization",
                "c": "Real-time Object Detection",
                "d": "Data Augmentation",
                "correct": "C"
            },
            {
                "text": "Which activation function outputs values in the range [0, 1]?",
                "a": "ReLU",
                "b": "Tanh",
                "c": "Sigmoid",
                "d": "Leaky ReLU",
                "correct": "C"
            },
            {
                "text": "Which MediaPipe solution is used to track 468 3D facial landmarks?",
                "a": "Face Mesh",
                "b": "Objectron",
                "c": "Selfie Segmentation",
                "d": "Holistic",
                "correct": "A"
            }
        ]
        
        for q in questions:
            Question.create(
                exam_id,
                q["text"],
                q["a"],
                q["b"],
                q["c"],
                q["d"],
                q["correct"],
                20 # 20 points per question (Total 100)
            )
        print("[SEEDER] Seeded 5 sample MCQ questions successfully.")
    else:
        print("[SEEDER] Exams already exist in database. Skipping exams seed.")
        
    print("[SEEDER] Database seeding process completed successfully!")

if __name__ == '__main__':
    seed_database()
