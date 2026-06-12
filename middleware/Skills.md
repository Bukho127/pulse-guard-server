Summary: I collected all HTTP endpoints and auth requirements so you can connect the frontend. Links point to the route and controller files for details.

Auth / Register: POST /auth/register — Public. Body: user object (registration fields). Handler: userRoutes.js → userControllers.js.

Auth / Login (user): POST /auth/login — Public. Body: { email, password }. Returns { token }. Handler: userRoutes.js → userControllers.js.

Legacy user create/login: POST /users, POST /users/login — same as above. Handler: userRoutes.js.

Get all users: GET /users — Protected; protect + authorizePersonnel (personnel only). Handler:
userRoutes.js → userControllers.js.

Get single user: GET /users/:userId — Protected; protect. Path param: userId. Handler: userRoutes.js → userControllers.js.

Update user: PUT /users/:userId — Protected; protect. Body: fields to update. Handler: userRoutes.js → userControllers.js.

Delete user: DELETE /users/:userId — Protected; protect. Handler: userRoutes.js → userControllers.js.

Police login: POST /auth/personnel/login and POST /police/login — Public. Body: { email, password }. Returns { token } (personnel role). Handler
userRoutes.js → userControllers.js.

Police login: POST /auth/personnel/login and POST /police/login — Public. Body: { email, password }. Returns { token } (personnel role). Handler: policePersonnelRoutes.js → policePersonnelController.js.

Add police personnel: POST /police — Public (creates officer). Body: officer object. Handler: policePersonnelRoutes.js → policePersonnelController.js.

Get all personnel: GET /police — Protected; protect + authorizePersonnel. Handler: policePersonnelRoutes.js.

Get/update/delete personnel: GET /police/:id, PUT /police/:id, DELETE /police/:id — Protected; protect + authorizePersonnel. Path param: id. Handler: policePersonnelRoutes.js.

Create incident: POST /incidents — Protected;
authorizePersonnel. Path param: id. Handler: policePersonnelRoutes.js.

Create incident: POST /incidents — Protected; protect + authorizeUser. Multipart form-data: file field video and body fields latitude, longitude, address. Response: created incident. Handler:
incidentRoutes.js → incidentController.js.

Get my incidents: GET /incidents/my — Protected; protect + authorizeUser. Handler: incidentRoutes.js → incidentController.js.

Get my incident by id: GET /incidents/my/:incidentId — Protected; protect + authorizeUser. Path param: incidentId. Handler: incidentRoutes.js.

Get single incident (personnel): GET /incidents/:incidentId — Protected; protect + authorizePersonnel. Handler: incidentRoutes.js.

Get all incidents (personnel): GET /incidents — Protected; protect + authorizePersonnel. Handler: incidentRoutes.js.

Update incident status: PUT /incidents/:incidentId/status — Protected; protect + autho
protect + authorizePersonnel. Body: { status } (if status === 'acknowledged', acknowledged_at set). Handler: incidentRoutes.js → incidentController.js.

Delete incident: DELETE /incidents/:incidentId — Protected; protect + authorizePersonnel. Handler: incidentRoutes.js.

Heatmap (all acknowledged incidents): GET /heatmap — Protected; protect + authorizePersonnel. Returns grid of { latitude, longitude, weight }. Handler: heatmapRoutes.js → heatmapController.js.

Heatmap by date range: GET /heatmap/range?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD — Protected; protect + authorizePersonnel. Query params: startDate, endDate. Handler: heatmapRoutes.js →
heatmapController.js.

Create notification: POST /notifications — Protected (router uses protect); requires authorizePersonnel for creation. Body: { incident_id, message, user_id? or security_personnel_id?, notification_type? }. Returns created notification. Handler: notificationRoutes.js → notificationController.js.

Get notifications (for authenticated user/personnel): GET /notifications — Protected (protect on router). Handler: notificationRoutes.js → notificationController.js.

Get unread notifications: GET /notifications/unread — Protected. Handler: notificationRoutes.js → notificationController.js.

Notify personnel nearby (for an incident): POST /notifications/incidents/:incidentId/personnel-nearby — Protected; authorizePersonnel. Body optional

{ message }. Handler: notificationRoutes.js → notificationController.js.

Mark notification read: PUT /notifications/:id/read — Protected. Path param: id. Handler: notificationRoutes.js → notificationController.js.

Delete notification: DELETE /notifications/:id — Protected. Path param: id. Handler: notificationRoutes.js.

WebSocket (Socket.io) connection: Authenticate socket by sending JWT in auth.token or Authorization header (Bearer token). On connection server joins personnel:<security_personnel_id> or user:<user_id> rooms. See server.js and socketService.js.

Notes:

Protected endpoints require the Authorization: Bearer <token> header (JWT). Personnel vs user access enforced via authorizePersonnel and authorizeUser middleware — see authMiddleware.js.
File upload: POST /incidents uses multipart video field (upload.single('video')) and then compressVideo middleware — see uploadsMiddleware.js.
For exact request/response shapes, check the controller files linked above.
Finished listing endpoints. Do you want a ready-to-use Postman collection (JSON) or example fetch/axios snippets for the dashboard?

I'll mark the TODO as completed, then provide an axios-ready list of full endpoint URLs and short notes.

Completed: Deliver formatted endpoints list (3/3)

Base URL suggestion: set BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000'

Auth

POST {BASE_URL}/auth/register
POST {BASE_URL}/auth/login
POST {BASE_URL}/users
POST {BASE_URL}/users/login
POST {BASE_URL}/auth/personnel/login
POST {BASE_URL}/police/login

Users

GET {BASE_URL}/users (protected — personnel)
GET {BASE_URL}/users/:userId (protected)
PUT {BASE_URL}/users/:userId (protected)
DELETE{BASE_URL}/users/:userId (protected)
Police / Personnel

Police / Personnel

POST {BASE_URL}/police (create officer)
GET {BASE_URL}/police (protected — personnel)
GET {BASE_URL}/police/:id (protected)
PUT {BASE_URL}/police/:id (protected)
DELETE{BASE_URL}/police/:id (protected)

Incidents

POST {BASE_URL}/incidents (protected — user) — multipart form-data: file field video, body latitude, longitude, address
GET {BASE_URL}/incidents (protected — personnel)
GET {BASE_URL}/incidents/:incidentId (protected — personnel)
GET {BASE_URL}/incidents/my (protected — user)
GET {BASE_URL}/incidents/my/:incidentId (protected — user)
PUT {BASE_URL}/incidents/:incidentId/status (protected — personnel) — body { status }
DELETE{BASE_URL}/incidents/:incidentId (protected — personnel)

Heatmap

GET {BASE_URL}/heatmap (protected — personnel)
GET {BASE_URL}/heatmap/range?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD (protected — personnel)

Notifications

POST {BASE_URL}/notifications (protected; creation requires personnel) — body { incident_id, message, user_id? or security_personnel_id?, notification_type? }
GET {BASE_URL}/notifications (protected)
GET {BASE_URL}/notifications/unread (protected)
POST {BASE_URL}/notifications/incidents/:incidentId/personnel-nearby (protected — personnel) — optional body { message }
PUT {BASE_URL}/notifications/:id/read (protected)
DELETE{BASE_URL}/notifications/:id (protected)

WebSocket (Socket.io)

URL ws/sock via Socket.IO at {BASE_URL} — send JWT in auth.token or Authorization: Bearer <token> when connecting. Server joins rooms personnel:<security_personnel_id> or user:<user_id>.
Auth header for protected endpoints

Header: Authorization: Bearer <token>
Quick axios examples

Base:

const BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000'
axios.defaults.baseURL = BASE
axios.defaults.headers.common['Authorization'] = Bearer ${token}

Upload (incident):

const form = new FormData(); form.append('video', file); form.append('latitude', lat); form.append('longitude', lng); form.append('address', addr);
axios.post('/incidents', form, { headers: { 'Content-Type': 'multipart/form-








