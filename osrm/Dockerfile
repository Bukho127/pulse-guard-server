FROM osrm/osrm-backend
COPY CapeTown.osrm* /data/
EXPOSE 5000
CMD ["osrm-routed", "--algorithm", "mld", "/data/CapeTown.osrm"]
