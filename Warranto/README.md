# Warranto – Digital Warranty & Bill Manager

**Your purchases. Your bills. Your warranties. One place.**

Live Demo

Published Application: https://warranto.vercel.app/

Warranto is a digital warranty and bill management platform designed to help users organize their purchase records, store bills, and track product warranty periods in one place. It reduces the hassle of managing physical receipts and helps users keep track of important warranty information.

## Features

- **Product Management:** Add, view, and manage purchased products.
- **Warranty Tracking:** Store warranty details and monitor warranty expiry dates.
- **Bill Management:** Upload and manage digital copies of purchase bills.
- **User Authentication:** Secure registration and login using JWT-based authentication.
- **Cloud Storage:** Store uploaded bill documents using Cloudinary.
- **Email Notifications:** Send email reminders for important warranty dates.
- **Responsive Interface:** Access the application through a user-friendly interface across different screen sizes.

## Tech Stack

| Category | Technologies |
|---|---|
| Frontend | React.js, Vite, JavaScript |
| Styling | Tailwind CSS |
| Backend | Node.js, Express.js |
| Database | MongoDB Atlas |
| Authentication | JWT, bcrypt |
| File Storage | Cloudinary |
| Email Service | Nodemailer |

## Project Structure

```text
Warranto/
├── frontend/
│   ├── src/
│   ├── public/
│   └── package.json
│
├── backend/
│   ├── controllers/
│   ├── routes/
│   ├── models/
│   ├── middleware/
│   ├── config/
│   └── package.json
│
└── README.md
```

*The structure above is illustrative; adjust folder names to match the actual project.*

## Getting Started

### Prerequisites

- Node.js and npm
- MongoDB Atlas account
- Cloudinary account
- Email service credentials

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
```

2. Navigate to the project directory:

```bash
cd Warranto
```

3. Install frontend and backend dependencies:

```bash
cd frontend
npm install
```

```bash
cd ../backend
npm install
```

4. Configure the required environment variables in a `.env` file inside the backend directory.

Example:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
EMAIL_USER=your_email
EMAIL_PASS=your_email_app_password
```

5. Start the backend:

```bash
npm run dev
```

6. Open another terminal and start the frontend:

```bash
cd frontend
npm run dev
```

7. Open the local URL displayed by Vite in your browser.

## Security

- Passwords are hashed using bcrypt.
- Protected routes use JWT authentication.
- Environment variables are used for sensitive configuration.
- Uploaded bill documents are managed through Cloudinary.

## Future Improvements

- Warranty expiry notifications and reminders.
- Product warranty analytics.
- Improved bill search and filtering.
- Additional document management features.

## Author

**Jaswanth Chennamsetti**

Computer Science and Engineering Student

---

**Warranto – Making purchase and warranty management simpler.**
