import { BrowserRouter, Route, Routes } from 'react-router-dom'
import AdminRoutes from './admin/routes/AdminRoutes.jsx'
import CustomerRoutes from './customer/routes/CustomerRoutes.jsx'

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/admin/*" element={<AdminRoutes />} />
                <Route path="/*" element={<CustomerRoutes />} />
            </Routes>
        </BrowserRouter>
    );
}
