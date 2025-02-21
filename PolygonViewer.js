class PolygonViewer {
    // ============== CONSTRUCTOR & INITIALIZATION ==============
    /**
     * Initializes the PolygonViewer class. 
     * Sets up the data, sections, and the current section to render. 
     * Also initializes 2D and 3D viewers.
     * 
     * @param {Object} jsonData The JSON data containing the polygon sections, passed to the constructor.
     */
    constructor(jsonData) {
        this.data = jsonData;
        this.sections = this.data.polygonsBySection;
        this.currSection = this.sections[0];
        this.meshes = [];   // Stores meshes
        this.gridHelper3D = null;       // 3D grid helper
        this.axesHelper3D = null;       // 3D axes helper
        this.labels = [];   // Stores axis labels
        this.init2DViewer();
        this.init3DViewer();
    }

    /**
     * Initializes the 2D viewer using D3.js. 
     * Sets up the SVG container, zoom behavior, grid, and axes. 
     * Also sets up a dropdown to select different sections of the polygons.
     */
    init2DViewer() {
        // Setup SVG container
        const margin = { top: 20, right: 20, bottom: 30, left: 40 };
        const width = 600 - margin.left - margin.right;
        const height = 400 - margin.top - margin.bottom;

        this.svg = d3.select('#viewer2d')
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Create clip path
        this.svg.append('defs')
            .append('clipPath')
            .attr('id', 'clip')
            .append('rect')
            .attr('width', width)
            .attr('height', height);

        // Setup zoom behavior
        const zoom = d3.zoom()
            .scaleExtent([0.5, 10])
            .on('zoom', (event) => {
                this.g.attr('transform', event.transform);
                this.update2DAxes(event.transform);
                this.update2DGrid(event.transform);
            });

        this.svg.call(zoom);

        // Create group for grid (added before polygons group)
        this.gridGroup = this.svg.append('g')
            .attr('class', 'grid')
            .attr('clip-path', 'url(#clip)');

        // Create group for polygons
        this.g = this.svg.append('g')
            .attr('clip-path', 'url(#clip)');

        // Setup dropdown for section selection
        const dropdown = d3.select('#sectionSelect')
            .on('change', () => {
                this.update2DSection();
                this.update3DSection();
            });

        // Populate dropdown with section names
        dropdown.selectAll('option')
            .data(this.sections)
            .enter()
            .append('option')
            .text(d => d.sectionName)
            .attr('value', d => d.sectionId);

        // Setup scales
        this.xScale = d3.scaleLinear().range([0, width]);
        this.yScale = d3.scaleLinear().range([height, 0]);

        // Setup axes
        this.xAxis = this.svg.append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0,${height})`);

        this.yAxis = this.svg.append('g')
            .attr('class', 'y-axis');

        // Add axis labels
        this.svg.append('text')
            .attr('class', 'axis-label')
            .attr('x', width / 2)
            .attr('y', height + margin.bottom)
            .style('text-anchor', 'middle')
            .text('X');

        this.svg.append('text')
            .attr('class', 'axis-label')
            .attr('transform', 'rotate(-90)')
            .attr('x', -height / 2)
            .attr('y', -margin.left)
            .style('text-anchor', 'middle')
            .text('Y');

        // Draw initial section
        this.update2DSection();
    }

    /**
     * Initializes the 3D viewer using Three.js. 
     * Sets up the scene, camera, renderer, controls, grid, lighting, and polygons. 
     * Starts the animation loop.
     */
    init3DViewer() {
        // Setup Three.js scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf0f0f0);

        // Setup camera
        this.camera = new THREE.PerspectiveCamera(75,
            document.getElementById('viewer3d').clientWidth /
            document.getElementById('viewer3d').clientHeight,
            0.1, 100000);

        // Setup renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(
            document.getElementById('viewer3d').clientWidth,
            document.getElementById('viewer3d').clientHeight
        );
        document.getElementById('viewer3d').appendChild(this.renderer.domElement);

        // Add controls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;

        // Create 3D grid
        this.create3DGrid();

        // Add lighting
        const ambientLight = new THREE.AmbientLight(0x404040);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight.position.set(1, 1, 1);
        this.scene.add(directionalLight);

        // Draw all polygons of current section
        this.draw3DSection();

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize(), false);

        // Start animation loop
        this.animate();
    }

    // ============== GRID-RELATED METHODS ==============
    /**
     * Creates the grid for the 2D view, including vertical and horizontal grid lines 
     *      based on the xScale and yScale provided.
     * 
     * @param {d3.ScaleLinear} xScale The scale used for the x-axis.
     * @param {d3.ScaleLinear} yScale The scale used for the y-axis.
     */
    create2DGrid(xScale, yScale) {
        const xTicks = xScale.ticks(10);
        const yTicks = yScale.ticks(10);

        // Create vertical grid lines
        const verticalGrid = this.gridGroup.selectAll('.vertical-grid')
            .data(xTicks);

        verticalGrid.exit().remove();

        verticalGrid.enter()
            .append('line')
            .merge(verticalGrid)
            .attr('class', 'vertical-grid')
            .attr('x1', d => xScale(d))
            .attr('y1', 0)
            .attr('x2', d => xScale(d))
            .attr('y2', this.yScale.range()[0])
            .style('stroke', '#e0e0e0')
            .style('stroke-width', '0.5px');

        // Create horizontal grid lines
        const horizontalGrid = this.gridGroup.selectAll('.horizontal-grid')
            .data(yTicks);

        horizontalGrid.exit().remove();

        horizontalGrid.enter()
            .append('line')
            .merge(horizontalGrid)
            .attr('class', 'horizontal-grid')
            .attr('x1', 0)
            .attr('y1', d => yScale(d))
            .attr('x2', this.xScale.range()[1])
            .attr('y2', d => yScale(d))
            .style('stroke', '#e0e0e0')
            .style('stroke-width', '0.5px');
    }

    /**
     * Creates and adds a 3D grid to the scene. 
     * Calculates the grid size based on the section's bounds and also adds the axes helper. 
     * Ensures that the previous grid and axes helpers are removed before creating new ones.
     */
    create3DGrid() {
        // Remove the old grid helper
        if (this.gridHelper3D) {
            this.scene.remove(this.gridHelper3D);
        }

        // Remove the old axes helper
        if (this.axesHelper3D) {
            this.scene.remove(this.axesHelper3D);
        }

        // Clear any existing labels
        if (this.labels) {
            this.labels.forEach(label => this.scene.remove(label));
        }
        this.labels = [];

        // Calculate scene bounds from all vertices
        const allPoints = this.currSection.polygons.flatMap(polygon =>
            polygon.points3D.map(p => p.vertex)
        );

        const bounds = {
            minX: Math.min(...allPoints.map(p => p[0])),
            maxX: Math.max(...allPoints.map(p => p[0])),
            minY: Math.min(...allPoints.map(p => p[1])),
            maxY: Math.max(...allPoints.map(p => p[1])),
            minZ: Math.min(...allPoints.map(p => p[2])),
            maxZ: Math.max(...allPoints.map(p => p[2]))
        };

        // Calculate grid size based on scene bounds
        const gridSize = Math.max(
            bounds.maxX - bounds.minX,
            bounds.maxY - bounds.minY
        ) * 2;

        const gridDivisions = 50;

        // Add grid
        this.gridHelper3D = new THREE.GridHelper(gridSize, gridDivisions);
        this.scene.add(this.gridHelper3D);

        // Add axes helper
        this.axesHelper3D = new THREE.AxesHelper(gridSize / 2);
        this.scene.add(this.axesHelper3D);

         // Create axis labels
        const createLabel = (text, position, color, size = 1.5) => {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = 512; // Increased canvas size for better resolution
            canvas.height = 512;
            
            // Draw text
            context.font = 'Bold 120px Arial'; // Increased font size
            context.fillStyle = color;
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText(text, 256, 256);
            
            const texture = new THREE.CanvasTexture(canvas);
            const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
            const sprite = new THREE.Sprite(spriteMaterial);
            sprite.position.copy(position);
            
            // Increased label size
            const labelSize = gridSize / 15 * size;
            sprite.scale.set(labelSize, labelSize, 1);
            
            return sprite;
        };

        // Add grid values
        const addGridValues = () => {
            const step = gridSize / gridDivisions;
            const valueOffset = step / 2;
            
            // Add X axis values
            for (let i = -gridDivisions/2; i <= gridDivisions/2; i++) {
                if (i !== 0) { // Skip 0 to avoid cluttering the center
                    const value = Math.round(i * step);
                    const label = createLabel(value.toString(), 
                        new THREE.Vector3(i * step, -valueOffset, 0), 
                        '#666666', 
                        0.8
                    );
                    this.labels.push(label);
                    this.scene.add(label);
                }
            }

            // Add Y axis values (Z in Three.js)
            for (let i = -gridDivisions/2; i <= gridDivisions/2; i++) {
                if (i !== 0) {
                    const value = Math.round(i * step);
                    const label = createLabel(value.toString(), 
                        new THREE.Vector3(-valueOffset, -valueOffset, i * step), 
                        '#666666', 
                        0.8
                    );
                    this.labels.push(label);
                    this.scene.add(label);
                }
            }
        };

        // Add main axis labels with increased size
        const labelOffset = gridSize / 2 + gridSize / 10;
        this.labels.push(createLabel('X', new THREE.Vector3(labelOffset, 0, 0), '#ff0000', 2));
        this.labels.push(createLabel('Y', new THREE.Vector3(0, 0, labelOffset), '#0000ff', 2));
        this.labels.push(createLabel('Z', new THREE.Vector3(0, labelOffset, 0), '#00ff00', 2));

        // Add grid values
        addGridValues();

        // Add all labels to scene
        this.labels.forEach(label => this.scene.add(label));

        // Position camera based on scene bounds
        const cameraDistance = Math.max(gridSize, bounds.maxY) / 4;
        this.camera.position.set(cameraDistance, cameraDistance, cameraDistance);
        this.camera.lookAt(0, 0, 0);
    }

    // ============== SECTION HANDLING METHODS ==============
    /**
     * Updates the 2D grid when zooming or panning. 
     * Rescales the grid lines based on the zoom/pan transformation.
     * 
     * @param {d3.ZoomTransform | null} transform 
     */
    update2DGrid(transform) {
        if (transform) {
            const newXScale = transform.rescaleX(this.xScale);
            const newYScale = transform.rescaleY(this.yScale);
            this.create2DGrid(newXScale, newYScale);
        } else {
            this.create2DGrid(this.xScale, this.yScale);
        }
    }

    /**
     * Updates the 2D section based on the selected section. 
     * Updates the scales, redraws the polygons, and updates the grid and axes.
     */
    update2DSection() {
        const sectionId = d3.select('#sectionSelect').property('value');
        this.currSection = this.sections.find(s => s.sectionId === sectionId);

        if (!this.currSection) return;

        // Check if current section has polygons
        if (this.currSection.polygons.length == 0) {
            // Show message
            document.getElementById('emptySectionMessage').style.display = 'block';
        } else {
            // Hide message
            document.getElementById('emptySectionMessage').style.display = 'none';
        }

        // Update scales based on current section data
        const points = this.currSection.polygons.flatMap(p => p.points2D);
        const xExtent = d3.extent(points, d => d.vertex[0]);
        const yExtent = d3.extent(points, d => d.vertex[1]);

        // Add some padding to the domains
        const xPadding = (xExtent[1] - xExtent[0]) * 0.05;
        const yPadding = (yExtent[1] - yExtent[0]) * 0.05;

        this.xScale.domain([xExtent[0] - xPadding, xExtent[1] + xPadding]);
        this.yScale.domain([yExtent[0] - yPadding, yExtent[1] + yPadding]);

        // Update axes and grid
        this.xAxis.call(d3.axisBottom(this.xScale));
        this.yAxis.call(d3.axisLeft(this.yScale));
        this.update2DGrid();

        // Create line generator
        const lineGenerator = d3.line()
            .x(d => this.xScale(d.vertex[0]))
            .y(d => this.yScale(d.vertex[1]));

        // Update polygons
        const polygons = this.g.selectAll('.polygon')
            .data(this.currSection.polygons);

        // Remove old polygons
        polygons.exit().remove();

        // Add new polygons
        const newPolygons = polygons.enter()
            .append('path')
            .attr('class', 'polygon');

        // Update all polygons
        this.g.selectAll('.polygon')
            .attr('d', d => {
                // Close the polygon
                const points = d.points2D.slice();
                points.push(d.points2D[0]);
                return lineGenerator(points);
            })
            .style('fill', d => `#${d.color}`)
            .style('stroke', 'black')
            .style('opacity', 0.7)
            .on('click', (event, d) => {    // Change selected polygon's style
                this.g.selectAll('.polygon').style('stroke-width', 1).style('stroke', 'black');

                d3.select(event.currentTarget)
                    .style('stroke-width', 3)
                    .style('stroke', '#ff0000');
            });
    }

    /**
     * Updates the 3D section by removing old meshes, creating a new 3D grid, 
     *      and redrawing the 3D polygons.
     */
    update3DSection() {
        // Remove the old meshes from the scene
        this.meshes.forEach(mesh => {
            this.scene.remove(mesh);
        });

        // Create 3D Grid
        this.create3DGrid();

        // Draw 3D polygons
        this.draw3DSection();
    }

    /**
     * Draws the polygons of the current section in 3D space by creating extruded geometries
     *      and adding them to the scene.
     */
    draw3DSection() {
        // Clear the meshes array
        this.meshes = [];

        // Draw all polygons from current section
        this.currSection.polygons.forEach(polygon => {
            const points3D = polygon.points3D;

            // Create an array of 3D points
            const vertices = [];
            const triangles = [];

            // Convert points to Vector3
            points3D.forEach(point => (
                vertices.push(
                    new THREE.Vector3(
                        point.vertex[0],    // X
                        point.vertex[2],    // Z
                        point.vertex[1],    // Y
                    )
                )
            ));

            // Triangulate the polygon
            // We'll use the first point as the center and create triangles
            // This is a simple triangulation method - for complex polygons you might want to use a more robust algorithm
            for (let i = 0; i < vertices.length - 1; i++) {
                triangles.push(0); // Center point
                triangles.push(i + 1);
                triangles.push(i + 2 > vertices.length - 1 ? 1 : i + 2);
            }

            // Create geometry
            const geometry = new THREE.BufferGeometry();
            
            // Create positions array from vertices
            const positions = new Float32Array(vertices.length * 3);
            vertices.forEach((vertex, i) => {
                positions[i * 3] = vertex.x;
                positions[i * 3 + 1] = vertex.y;
                positions[i * 3 + 2] = vertex.z;
            });

            // Set attributes
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.setIndex(triangles);
            
            // Compute vertex normals for proper lighting
            geometry.computeVertexNormals();

            // Create material
            const material = new THREE.MeshPhongMaterial({
                color: parseInt(polygon.color, 16),
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.8
            });

            const mesh = new THREE.Mesh(geometry, material);
            this.meshes.push(mesh);
            this.scene.add(mesh);
        });
    } 

    // ============== UTILITY METHODS ==============
    /**
     * Adjusts the camera aspect ratio and the renderer size when the window is resized.
     */
    onWindowResize() {
        const container = document.getElementById('viewer3d');
        this.camera.aspect = container.clientWidth / container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(container.clientWidth, container.clientHeight);
    }

    /**
     * The main animation loop for the 3D scene. 
     * Continuously updates the camera controls and renders the scene.
     */
    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    /**
     * Updates the 2D axes based on the zoom/pan transformation. 
     * Rescales the axes according to the applied transformation.
     * 
     * @param {d3.ZoomTransform} transform 
     */
    update2DAxes(transform) {
        this.xAxis.call(d3.axisBottom(transform.rescaleX(this.xScale)));
        this.yAxis.call(d3.axisLeft(transform.rescaleY(this.yScale)));
    }
}

// Initialize the viewer when the JSON data is loaded
fetch('data.json')
    .then(response => response.json())
    .then(data => {
        const viewer = new PolygonViewer(data);
    })
    .catch(error => {
        console.error('Error loading JSON:', error);
    });