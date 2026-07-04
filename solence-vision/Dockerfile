# solence-vision — floor plan recognition service.
# Model weights are not baked in; mount ./models or bake them in a
# derived image once trained.
FROM python:3.11-slim

WORKDIR /srv/solence-vision

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ app/

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
